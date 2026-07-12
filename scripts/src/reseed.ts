import { db, moviesTable } from "@workspace/db";
import { IMDB_TOP_250_SEED } from "../../artifacts/api-server/src/lib/imdb-seed";

async function main() {
  const seen = new Set<string>();
  const unique = IMDB_TOP_250_SEED.filter((m) => {
    if (seen.has(m.imdbId)) return false;
    seen.add(m.imdbId);
    return true;
  });

  console.log(`Seeding ${unique.length} movies...`);

  await db.transaction(async (tx) => {
    await tx.delete(moviesTable);
    await tx.insert(moviesTable).values(
      unique.map((m) => ({
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

  console.log(`Done! Seeded ${unique.length} unique movies.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
