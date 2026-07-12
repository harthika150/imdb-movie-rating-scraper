import axios from "axios";
import * as cheerio from "cheerio";
import { db, moviesTable, scrapeRunsTable, watchlistTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";
import { IMDB_TOP_250_SEED } from "./imdb-seed";

export interface MovieRow {
  rank: number;
  title: string;
  year: number;
  rating: number;
  votes: string | null;
  imdbId: string;
  director: string | null;
  genres: string[] | null;
  runtime: number | null;
  plot: string | null;
  inWatchlist: boolean;
  watched: boolean;
}

interface ScrapeState {
  isScrapingNow: boolean;
}

const state: ScrapeState = { isScrapingNow: false };

export function isScrapingNow(): boolean {
  return state.isScrapingNow;
}

export async function getMoviesFromDb(): Promise<MovieRow[]> {
  const [movieRows, watchlistRows] = await Promise.all([
    db.select().from(moviesTable).orderBy(moviesTable.rank),
    db.select().from(watchlistTable),
  ]);

  const watchMap = new Map(watchlistRows.map((w) => [w.imdbId, w]));

  return movieRows.map((m) => {
    const w = watchMap.get(m.imdbId);
    return {
      rank: m.rank,
      title: m.title,
      year: m.year,
      rating: m.rating,
      votes: m.votes,
      imdbId: m.imdbId,
      director: m.director,
      genres: m.genres,
      runtime: m.runtime,
      plot: m.plot,
      inWatchlist: !!w,
      watched: w?.watched ?? false,
    };
  });
}

export async function getLastScrapeRun() {
  const rows = await db
    .select()
    .from(scrapeRunsTable)
    .orderBy(desc(scrapeRunsTable.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getScrapeHistory() {
  return db
    .select()
    .from(scrapeRunsTable)
    .orderBy(desc(scrapeRunsTable.startedAt))
    .limit(50);
}

export async function getTotalMovieCount(): Promise<number> {
  const rows = await db.select({ rank: moviesTable.rank }).from(moviesTable);
  return rows.length;
}

export async function addToWatchlist(imdbId: string) {
  const existing = await db.select().from(watchlistTable).where(eq(watchlistTable.imdbId, imdbId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(watchlistTable).values({ imdbId, watched: false }).returning();
  return row;
}

export async function removeFromWatchlist(imdbId: string) {
  await db.delete(watchlistTable).where(eq(watchlistTable.imdbId, imdbId));
}

export async function markWatched(imdbId: string, watched: boolean) {
  const existing = await db.select().from(watchlistTable).where(eq(watchlistTable.imdbId, imdbId)).limit(1);
  if (existing.length === 0) {
    const [row] = await db
      .insert(watchlistTable)
      .values({ imdbId, watched, watchedAt: watched ? new Date() : null })
      .returning();
    return row;
  }
  const [row] = await db
    .update(watchlistTable)
    .set({ watched, watchedAt: watched ? new Date() : null })
    .where(eq(watchlistTable.imdbId, imdbId))
    .returning();
  return row;
}

export async function seedDatabase(): Promise<void> {
  const seen = new Set<string>();
  const unique = IMDB_TOP_250_SEED.filter((m) => {
    if (seen.has(m.imdbId)) return false;
    seen.add(m.imdbId);
    return true;
  });
  const movies = unique.map((m, i) => ({ ...m, rank: i + 1 }));

  await db.transaction(async (tx) => {
    await tx.delete(moviesTable);
    await tx.insert(moviesTable).values(
      movies.map((m) => ({
        rank: m.rank,
        title: m.title,
        year: m.year,
        rating: m.rating,
        votes: m.votes,
        imdbId: m.imdbId,
        director: m.director,
        genres: m.genres,
        runtime: m.runtime,
        plot: m.plot,
        scrapedAt: new Date(),
      })),
    );
  });

  await db.insert(scrapeRunsTable).values({
    completedAt: new Date(),
    totalScraped: movies.length,
    durationMs: 0,
    success: "true",
    error: null,
  });

  logger.info({ count: movies.length }, "Curated IMDb Top 250 seed dataset loaded");
}

export async function scrapeImdbTop250(): Promise<{
  success: boolean;
  totalScraped: number;
  durationMs: number;
  error: string | null;
}> {
  if (state.isScrapingNow) {
    return { success: false, totalScraped: 0, durationMs: 0, error: "Scrape already in progress" };
  }

  state.isScrapingNow = true;
  const startTime = Date.now();

  try {
    logger.info("Starting IMDb Top 250 scrape");

    const response = await axios.get("https://www.imdb.com/chart/top/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
      timeout: 30000,
    });

    const html: string = response.data;

    if (html.includes("awsWafCookieDomainList") || html.includes("AwsWafIntegration") || html.includes("challenge.js")) {
      const durationMs = Date.now() - startTime;
      const error = "IMDb is rate-limiting this server. The curated dataset is shown instead. Try again later.";
      logger.warn(error);
      await db.insert(scrapeRunsTable).values({ completedAt: new Date(), totalScraped: 0, durationMs, success: "false", error });
      return { success: false, totalScraped: 0, durationMs, error };
    }

    const $ = cheerio.load(html);
    const movies: Omit<MovieRow, "inWatchlist" | "watched">[] = [];

    const jsonLdScript = $('script[type="application/ld+json"]').first().html();
    if (jsonLdScript) {
      try {
        const jsonData = JSON.parse(jsonLdScript);
        if (jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
          for (const item of jsonData.itemListElement) {
            const rank = item.position;
            const name = item.item?.name ?? "";
            const url: string = item.item?.url ?? "";
            const imdbId = url.match(/\/title\/(tt\d+)\//)?.[1] ?? "";
            const ratingValue = item.item?.aggregateRating?.ratingValue ?? 0;
            const ratingCount = item.item?.aggregateRating?.ratingCount ?? null;
            let year = 0;
            const descText: string = item.item?.description ?? "";
            const yearMatch = descText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) year = parseInt(yearMatch[0], 10);
            let votes: string | null = null;
            if (ratingCount) {
              const count = parseInt(String(ratingCount).replace(/,/g, ""), 10);
              if (count >= 1_000_000) votes = `${(count / 1_000_000).toFixed(1)}M`;
              else if (count >= 1_000) votes = `${Math.round(count / 1_000)}K`;
              else votes = String(count);
            }
            // Try to match seed data to get enriched info
            const seedMatch = IMDB_TOP_250_SEED.find((s) => s.imdbId === imdbId);
            if (imdbId && name) {
              movies.push({
                rank,
                title: name,
                year,
                rating: parseFloat(String(ratingValue)),
                votes,
                imdbId,
                director: seedMatch?.director ?? null,
                genres: seedMatch?.genres ?? null,
                runtime: seedMatch?.runtime ?? null,
                plot: seedMatch?.plot ?? null,
              });
            }
          }
        }
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse JSON-LD, trying HTML fallback");
      }
    }

    if (movies.length === 0) {
      $("li.ipc-metadata-list-summary-item").each((index, el) => {
        const rank = index + 1;
        const titleEl = $(el).find('[data-testid="titleColumn"] a, .ipc-title__text, h3.ipc-title__text');
        const title = titleEl.first().text().replace(/^\d+\.\s*/, "").trim();
        const href = $(el).find("a.ipc-title-link-wrapper, a[href*='/title/tt']").first().attr("href") ?? "";
        const imdbId = href.match(/\/title\/(tt\d+)\//)?.[1] ?? "";
        const yearText = $(el).find(".cli-title-metadata-item, .secondaryInfo").first().text().trim();
        const year = parseInt(yearText.replace(/[()]/g, ""), 10) || 0;
        const ratingText = $(el).find('[data-testid="ratingGroup--imdb-rating"] .ipc-rating-star--rating').first().text().trim();
        const rating = parseFloat(ratingText) || 0;
        const seedMatch = IMDB_TOP_250_SEED.find((s) => s.imdbId === imdbId);
        if (imdbId && title) {
          movies.push({
            rank, title, year, rating, votes: null, imdbId,
            director: seedMatch?.director ?? null,
            genres: seedMatch?.genres ?? null,
            runtime: seedMatch?.runtime ?? null,
            plot: seedMatch?.plot ?? null,
          });
        }
      });
    }

    const durationMs = Date.now() - startTime;

    if (movies.length === 0) {
      const error = "No movies found — IMDb may have changed its page structure.";
      logger.warn(error);
      await db.insert(scrapeRunsTable).values({ completedAt: new Date(), totalScraped: 0, durationMs, success: "false", error });
      return { success: false, totalScraped: 0, durationMs, error };
    }

    await db.transaction(async (tx) => {
      await tx.delete(moviesTable);
      await tx.insert(moviesTable).values(
        movies.map((m) => ({
          rank: m.rank, title: m.title, year: m.year, rating: m.rating,
          votes: m.votes ?? null, imdbId: m.imdbId,
          director: m.director, genres: m.genres, runtime: m.runtime, plot: m.plot,
          scrapedAt: new Date(),
        })),
      );
    });

    await db.insert(scrapeRunsTable).values({ completedAt: new Date(), totalScraped: movies.length, durationMs, success: "true", error: null });
    logger.info({ count: movies.length, durationMs }, "IMDb scrape completed and persisted");
    return { success: true, totalScraped: movies.length, durationMs, error: null };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, durationMs }, "IMDb scrape failed");
    await db.insert(scrapeRunsTable).values({ completedAt: new Date(), totalScraped: 0, durationMs, success: "false", error: message });
    return { success: false, totalScraped: 0, durationMs, error: message };
  } finally {
    state.isScrapingNow = false;
  }
}

export function computeStats(movies: MovieRow[], watchedCount: number, watchlistCount: number) {
  if (movies.length === 0) {
    return {
      totalMovies: 0, averageRating: 0, highestRating: 0, lowestRating: 0,
      newestYear: 0, oldestYear: 0, averageRuntime: null,
      watchedCount: 0, watchlistCount: 0,
      ratingDistribution: [], decadeDistribution: [], genreDistribution: [], topDirectors: [],
    };
  }

  const ratings = movies.map((m) => m.rating).filter((r) => r > 0);
  const years = movies.map((m) => m.year).filter((y) => y > 0);
  const runtimes = movies.map((m) => m.runtime).filter((r): r is number => r != null && r > 0);

  const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const averageRuntime = runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;

  const buckets: Record<string, number> = {};
  for (let r = 8.0; r < 10.0; r += 0.5) {
    const key = `${r.toFixed(1)}–${(r + 0.5).toFixed(1)}`;
    buckets[key] = 0;
  }
  for (const rating of ratings) {
    const floor = Math.floor(rating * 2) / 2;
    const key = `${floor.toFixed(1)}–${(floor + 0.5).toFixed(1)}`;
    if (key in buckets) buckets[key]++;
  }
  const ratingDistribution = Object.entries(buckets).map(([range, count]) => ({ range, count }));

  const decades: Record<string, number> = {};
  for (const year of years) {
    const decade = `${Math.floor(year / 10) * 10}s`;
    decades[decade] = (decades[decade] ?? 0) + 1;
  }
  const decadeDistribution = Object.entries(decades)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([decade, count]) => ({ decade, count }));

  const genreCounts: Record<string, number> = {};
  for (const m of movies) {
    for (const g of m.genres ?? []) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const genreDistribution = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([genre, count]) => ({ genre, count }));

  const directorMap: Record<string, { count: number; totalRating: number }> = {};
  for (const m of movies) {
    if (!m.director) continue;
    if (!directorMap[m.director]) directorMap[m.director] = { count: 0, totalRating: 0 };
    directorMap[m.director].count++;
    directorMap[m.director].totalRating += m.rating;
  }
  const topDirectors = Object.entries(directorMap)
    .filter(([, v]) => v.count >= 2)
    .map(([director, v]) => ({
      director,
      count: v.count,
      avgRating: Math.round((v.totalRating / v.count) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating)
    .slice(0, 15);

  return {
    totalMovies: movies.length,
    averageRating: Math.round(averageRating * 100) / 100,
    highestRating: Math.max(...ratings),
    lowestRating: Math.min(...ratings),
    newestYear: Math.max(...years),
    oldestYear: Math.min(...years),
    averageRuntime: averageRuntime != null ? Math.round(averageRuntime) : null,
    watchedCount,
    watchlistCount,
    ratingDistribution,
    decadeDistribution,
    genreDistribution,
    topDirectors,
  };
}
