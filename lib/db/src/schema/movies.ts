import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moviesTable = pgTable("movies", {
  id: serial("id").primaryKey(),
  rank: integer("rank").notNull(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  rating: real("rating").notNull(),
  votes: text("votes"),
  imdbId: text("imdb_id").notNull().unique(),
  director: text("director"),
  genres: text("genres").array(),
  runtime: integer("runtime"),
  plot: text("plot"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
});

export const watchlistTable = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  imdbId: text("imdb_id").notNull().unique(),
  watched: boolean("watched").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  watchedAt: timestamp("watched_at", { withTimezone: true }),
});

export const scrapeRunsTable = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  totalScraped: integer("total_scraped").notNull().default(0),
  durationMs: integer("duration_ms"),
  success: text("success").notNull().default("false"),
  error: text("error"),
});

export const insertMovieSchema = createInsertSchema(moviesTable).omit({ id: true, scrapedAt: true });
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof moviesTable.$inferSelect;

export const insertWatchlistSchema = createInsertSchema(watchlistTable).omit({ id: true, addedAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type WatchlistEntry = typeof watchlistTable.$inferSelect;

export const insertScrapeRunSchema = createInsertSchema(scrapeRunsTable).omit({ id: true });
export type InsertScrapeRun = z.infer<typeof insertScrapeRunSchema>;
export type ScrapeRun = typeof scrapeRunsTable.$inferSelect;
