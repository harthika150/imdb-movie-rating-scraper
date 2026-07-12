import app from "./app";
import { logger } from "./lib/logger";
import { scrapeImdbTop250, getTotalMovieCount, isScrapingNow, seedDatabase } from "./lib/imdb-scraper";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function autoPopulateIfEmpty() {
  try {
    const count = await getTotalMovieCount();
    if (count > 0) {
      logger.info({ count }, "Database already populated — skipping auto-seed");
      return;
    }

    // Try live scrape first, fall back to curated seed dataset
    logger.info("Database is empty — attempting live IMDb scrape");
    const scrapeResult = await scrapeImdbTop250();

    if (scrapeResult.success) {
      logger.info({ totalScraped: scrapeResult.totalScraped, durationMs: scrapeResult.durationMs }, "Live scrape succeeded on startup");
    } else {
      logger.warn({ error: scrapeResult.error }, "Live scrape failed — loading curated seed dataset");
      await seedDatabase();
      logger.info("Curated IMDb Top 250 seed dataset loaded");
    }
  } catch (err) {
    logger.error({ err }, "Error during startup auto-populate");
  }
}

function scheduleRefresh() {
  setInterval(async () => {
    if (isScrapingNow()) {
      logger.info("Scheduled refresh skipped — scrape already in progress");
      return;
    }
    logger.info("Running scheduled IMDb Top 250 refresh");
    const result = await scrapeImdbTop250();
    if (result.success) {
      logger.info({ totalScraped: result.totalScraped, durationMs: result.durationMs }, "Scheduled refresh completed");
    } else {
      logger.warn({ error: result.error }, "Scheduled refresh failed — keeping existing data");
    }
  }, REFRESH_INTERVAL_MS);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  autoPopulateIfEmpty().catch((err) => logger.error({ err }, "Unhandled error in autoPopulateIfEmpty"));
  scheduleRefresh();
});
