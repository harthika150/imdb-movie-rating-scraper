# IMDb Movie Rating Scraper

A web app that scrapes the IMDb Top 250 movies list and displays the data with sorting, filtering, and CSV export. Movie data is persisted to PostgreSQL so it survives server restarts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/imdb-scraper run dev` — run the frontend (uses PORT env var)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to the database

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Scraping: axios + cheerio (IMDb Top 250 page)
- Database: PostgreSQL via Drizzle ORM (`@workspace/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + shadcn/ui + Tailwind CSS
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/movies.ts` — movies + scrape_runs table definitions
- `artifacts/api-server/src/lib/imdb-scraper.ts` — scraping logic + DB persistence
- `artifacts/api-server/src/routes/movies.ts` — movies, stats, scrape endpoints
- `artifacts/imdb-scraper/src/` — React frontend

## Architecture decisions

- PostgreSQL (Replit managed) persists movies and scrape run history. Data survives server restarts.
- Each scrape replaces all movie rows in a transaction (delete + insert), keeping the table clean.
- Scrape run history recorded in `scrape_runs` table (startedAt, completedAt, totalScraped, durationMs, success, error).
- IMDb Top 250 scraped with axios + cheerio; JSON-LD script tag is the primary source, HTML fallback if that fails.
- CSV export is generated client-side from the movie data array (no server-side file generation needed).

## Product

- Browse all 250 movies in a searchable, sortable, filterable table
- Filter by rating range and release year
- Sort by rank, title, year, or rating
- Trigger a fresh scrape from IMDb with one click
- Export the full list to CSV
- Statistics dashboard with rating and decade distributions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- IMDb may rate-limit or block scrape requests. The scraper sends a browser User-Agent header to reduce this.
- The scraper tries the JSON-LD script tag first (more reliable), then falls back to HTML parsing.
- Year extraction from JSON-LD comes from the description field (IMDb doesn't always include year in the structured data directly).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
