import { Router, type IRouter } from "express";
import {
  ListMoviesQueryParams,
  ListMoviesResponse,
  GetMovieStatsResponse,
  GetScrapeStatusResponse,
  GetScrapeHistoryResponse,
  TriggerScrapeResponse,
  AddToWatchlistResponse,
  MarkWatchedResponse,
  UnmarkWatchedResponse,
} from "@workspace/api-zod";
import {
  scrapeImdbTop250,
  getMoviesFromDb,
  getLastScrapeRun,
  getScrapeHistory,
  getTotalMovieCount,
  isScrapingNow,
  computeStats,
  addToWatchlist,
  removeFromWatchlist,
  markWatched,
} from "../lib/imdb-scraper";
import { db, watchlistTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/movies", async (req, res): Promise<void> => {
  const parsed = ListMoviesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, sortBy, sortOrder, minRating, maxRating, minYear, maxYear, genre, watchlistOnly, watchedOnly } = parsed.data;
  let movies = await getMoviesFromDb();

  if (search) {
    const q = search.toLowerCase();
    movies = movies.filter((m) => m.title.toLowerCase().includes(q) || m.director?.toLowerCase().includes(q));
  }
  if (minRating != null) movies = movies.filter((m) => m.rating >= minRating);
  if (maxRating != null) movies = movies.filter((m) => m.rating <= maxRating);
  if (minYear != null) movies = movies.filter((m) => m.year >= minYear);
  if (maxYear != null) movies = movies.filter((m) => m.year <= maxYear);
  if (genre) movies = movies.filter((m) => m.genres?.includes(genre));
  if (watchlistOnly) movies = movies.filter((m) => m.inWatchlist);
  if (watchedOnly) movies = movies.filter((m) => m.watched);

  if (sortBy) {
    movies.sort((a, b) => {
      let diff = 0;
      if (sortBy === "rank") diff = a.rank - b.rank;
      else if (sortBy === "title") diff = a.title.localeCompare(b.title);
      else if (sortBy === "year") diff = a.year - b.year;
      else if (sortBy === "rating") diff = a.rating - b.rating;
      else if (sortBy === "runtime") diff = (a.runtime ?? 0) - (b.runtime ?? 0);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  res.json(ListMoviesResponse.parse(movies));
});

router.get("/movies/stats", async (_req, res): Promise<void> => {
  const movies = await getMoviesFromDb();
  const watchlistRows = await db.select().from(watchlistTable);
  const watchedCount = watchlistRows.filter((w) => w.watched).length;
  const watchlistCount = watchlistRows.length;
  const stats = computeStats(movies, watchedCount, watchlistCount);
  res.json(GetMovieStatsResponse.parse(stats));
});

router.get("/movies/scrape-status", async (_req, res): Promise<void> => {
  const [lastRun, total] = await Promise.all([getLastScrapeRun(), getTotalMovieCount()]);
  res.json(
    GetScrapeStatusResponse.parse({
      lastScrapedAt: lastRun?.completedAt?.toISOString() ?? null,
      totalMovies: total,
      isScrapingNow: isScrapingNow(),
    }),
  );
});

router.get("/scrape/history", async (_req, res): Promise<void> => {
  const history = await getScrapeHistory();
  res.json(
    GetScrapeHistoryResponse.parse(
      history.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        totalScraped: r.totalScraped,
        durationMs: r.durationMs,
        success: r.success,
        error: r.error,
      })),
    ),
  );
});

router.post("/movies/:imdbId/watchlist", async (req, res): Promise<void> => {
  const { imdbId } = req.params;
  const entry = await addToWatchlist(imdbId);
  res.json(
    AddToWatchlistResponse.parse({
      imdbId: entry.imdbId,
      watched: entry.watched,
      addedAt: entry.addedAt.toISOString(),
      watchedAt: entry.watchedAt?.toISOString() ?? null,
    }),
  );
});

router.delete("/movies/:imdbId/watchlist", async (req, res): Promise<void> => {
  const { imdbId } = req.params;
  await removeFromWatchlist(imdbId);
  res.status(204).send();
});

router.post("/movies/:imdbId/watched", async (req, res): Promise<void> => {
  const { imdbId } = req.params;
  const entry = await markWatched(imdbId, true);
  res.json(
    MarkWatchedResponse.parse({
      imdbId: entry.imdbId,
      watched: entry.watched,
      addedAt: entry.addedAt.toISOString(),
      watchedAt: entry.watchedAt?.toISOString() ?? null,
    }),
  );
});

router.delete("/movies/:imdbId/watched", async (req, res): Promise<void> => {
  const { imdbId } = req.params;
  const entry = await markWatched(imdbId, false);
  res.json(
    UnmarkWatchedResponse.parse({
      imdbId: entry.imdbId,
      watched: entry.watched,
      addedAt: entry.addedAt.toISOString(),
      watchedAt: entry.watchedAt?.toISOString() ?? null,
    }),
  );
});

router.post("/scrape", async (_req, res): Promise<void> => {
  if (isScrapingNow()) {
    res.status(409).json({ error: "Scrape already in progress" });
    return;
  }
  const result = await scrapeImdbTop250();
  res.json(TriggerScrapeResponse.parse(result));
});

export default router;
