# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NiceFilm streams real HLS video for any IMDb title ID and layers an English-learning toolkit on top (vocabulary, spelling/meaning self-tests, spaced-repetition review). A Go/Gin backend acts as a proxy that hides upstream sources and credentials from the browser; a React 19 frontend (Vite) consumes it. Two independent apps in `backend/` and `web/` — there is no root `package.json`.

## Commands

Backend (`cd backend`):
- `make dev` — run API on `:8081` (`go run ./cmd/server/main.go`)
- `make build` / `make run` — build to `bin/server` and run
- `make tidy` — `go mod tidy`
- Test: `go test ./...` (e.g. `internal/modules/learning/srs_test.go`); single: `go test ./internal/modules/learning -run TestName`

Frontend (`cd web`, uses **pnpm**):
- `pnpm dev` — Vite dev server on `:5173`
- `pnpm build` — production build
- `pnpm typecheck` — `tsc -b` (no-emit type check)
- `pnpm lint` — ESLint

Run both apps simultaneously for development; Vite proxies `/api` and `/hls` to `API_URL` (default `http://localhost:8081`), so the browser never calls the backend directly.

## Backend architecture

### A proxy, not a content store

The backend hides upstream sources, adds auth headers, rewrites responses, and dodges browser CORS/Referer restrictions. Each feature is a vertical-slice module under `internal/modules/` following a layered layout:
- `repo.go` — data access (interface + unexported impl)
- `service.go` — business logic (interface + unexported impl)
- `handler.go` — HTTP only
- `route.go` — the route table (`RegisterRoutes`, takes a `*Handler`)
- `module.go` — the `Module(...)` entry point that wires repo → service → handler
- `model.go` / `dto.go` — DB rows and frontend-facing shapes

`Repository`/`Service` are interfaces so the layer above can be tested against a mock. Stateless proxy modules (`stream/`, `subtitle/`) have no `repo.go`/`model.go`.

Shared infrastructure lives directly under `internal/`: `config/`, `database/`, `logger/`, `middleware/`, `app/`, `cache/` (a generic `cache.TTL[T]` in-memory cache with per-entry expiry, used for public user-independent upstream responses).

### Composition root

`internal/app/app.go` loads config, opens the SQLite DB, builds the Gin engine with global middleware (`Logger`, `Recovery`, `CORS`), and calls each module's `Module(...)`. It also builds a `user.NewCredentialStore(db)` and passes per-user-key resolvers into the optional integrations (see below).

Cross-module seams are kept thin:
- `title.Module` receives a `title.Enricher` so per-user state (favorites, watch progress, chosen subtitle) folds into title responses. `app.go` injects `history.NewEnricher(db)`, which satisfies the interface directly and forwards `FavoritedIds` to the `favorite` module — no adapter needed.
- `learning.Module` and `subtitle.Module` receive small key-resolver structs defined in `app.go` (`geminiKeys`, `openSubtitlesCreds`). `geminiKeys` resolves the user's stored key only (no `.env` fallback); `openSubtitlesCreds` tries the user's stored key first, then the `.env` fallback.

### Modules

- `user/` — accounts, settings, and per-user API keys (`credentials.go` / `CredentialStore`) for the optional integrations
- `favorite/` — watchlist; `GET /me/favorites` is paginated and embeds each title's detail server-side (imports `title`, hydrates a whole page in one batched IMDb request — same shape as continue-watching) so the My List grid needs no per-title lookups
- `history/` — watch progress, continue-watching, subtitle preference; imports `title` to hydrate (one batched request per page) and `favorite` to flag favorites; provides the `title.Enricher`
- `title/` — IMDb metadata (`service.go`/`repo.go` query `api.graphql.imdb.com` with hand-written GraphQL; `titleCardFields`/`titleDetailFields` are composable field-set constants reused across popular/trending/search/browse/similar/detail). Go structs mirror the GraphQL shape, then flatten into a `Title` DTO. The repo caches raw IMDb responses (single title, search/trending lists, browse pages) with a 1h TTL — *before* the service folds in per-user favorites/progress, so the cache stays user-independent. `FetchTitle`/`GetTitle` resolve one id; `FetchTitles`/`GetTitles` resolve many via IMDb's `titles(ids:[...])`, checking the cache first and batch-fetching only the misses (chunked by `titleBatchSize`) — used by the favorite/history page hydration.
- `stream/` — stream resolution + HLS proxy (see below)
- `subtitle/` — OpenSubtitles (optional)
- `learning/` — vocabulary, AI definitions/translations, self-tests, spaced repetition (see below)

### The three upstream integrations

1. **IMDb metadata** (`modules/title/`) — GraphQL against `api.graphql.imdb.com`.

2. **Stream resolution** (`modules/stream/service.go`, the `Stream` type) — proxies `/api/stream?...` to `streamdata.vaplayer.ru`, injecting the upstream `Referer`. Returns JSON with `stream_urls` and, for TV, an `eps` season→episode map. The Referer is discovered by `refererResolver`: it scrapes the embed page (`vaplayer.ru/embed/movie/...`) for its first `<iframe>` host once at startup (synchronously), then refreshes every 6h via a background ticker, falling back to `embedRefererDefault` when discovery fails. One resolver is shared by `Stream` and `HLS`. Successful stream resolutions are cached by query (sorted) with a 1h TTL.

3. **HLS proxy** (`modules/stream/service.go`, the `HLS` type) — the most important piece. `/hls?url=<absolute>` fetches an `.m3u8` or `.ts` with the required `Referer`. For manifests it **rewrites every URI** (segment lines and `URI="..."` attributes) back through `/hls`, resolving relative URLs to absolute first. This recursively keeps the whole playlist flowing through the backend so the CDN only ever sees the server's Referer, never the browser's. `/hls` is mounted at the engine root (outside `/api`), so `stream.Module` takes the engine as well as the `/api` group.

### Optional integrations (degrade gracefully)

- **OpenSubtitles** (`OPENSUBTITLES_API_KEY`, gated in `config.Load`) — `subtitle/` handler returns 503 when unconfigured. A per-user key (stored via `user.CredentialStore`) takes precedence over the `.env` key; otherwise the `.env` key is the fallback.
- **Gemini** (default model `gemini-2.5-flash`) — powers the learning module's AI definitions, translations, phrase/idiom explanations, word images, and AI-graded meaning tests (`modules/learning/gemini.go`). **Per-user only**: the key comes solely from `user.CredentialStore` — there is no `.env`/server-side fallback, so the server reads no `GEMINI_API_KEY`.

### Learning module

Routes under `/api/learn` (public dictionary/translate helpers) and `/api/me/*` (auth-required): word list CRUD + import, per-word stats, AI word images, phrase/idiom explanation, test submission/history, and SRS reviews. Spaced repetition uses the SM-2 algorithm in `srs.go` (covered by `srs_test.go`).

Config (`internal/config/config.go`): `Port` (8081), `Host` (`0.0.0.0`), `DBPath` (`./nicefilm.db`), required `JWTSecret`, and the optional `OpenSubtitles`/`Gemini` sub-configs. Auth is JWT via `middleware.AuthRequired(cfg)`.

## Frontend architecture

Data flow: `utils/` (pure logic) → `services/` (fetch wrappers) → `hooks/` (TanStack Query) → `pages/`/`components/`.

Key utilities in `utils/stream.ts`:
- `streamQuery` builds the `/api/stream` query, auto-detecting IMDb (`tt…`) vs TMDB ids.
- `bestUrl` picks the playable stream (prefers `master.m3u8`, avoids `justhd.tv`).
- `mergeEpisode`/`seasons`/`episodes` drive TV episode selection from the `eps` map.

`components/system/player/video-player.tsx` decides playback: HLS sources (`.m3u8`) route through `/hls` **only in dev** (`import.meta.env.DEV`); otherwise the raw src is used. This mirrors the backend HLS rewriting and is the seam to check when streams play locally but not in production.

Components split into `components/ui/` (Radix-based primitives) and `components/system/` (feature components grouped by domain: `layout/`, `title/`, `player/`, `learn/`, `common/`). Services mirror the backend: `auth.ts`, `title.ts`, `stream.ts`, `subtitle.ts`, `user.ts`, `learn.ts`, `dictionary.ts`. Path alias `@/` → `web/src/`.

### Routing

Routes are defined in `app.tsx` via `createBrowserRouter`. `MainLayout` wraps the browsing/learning pages; `WatchLayout` wraps `/watch/:id`; `/login` and `/signup` stand alone. Detail pages use `/title/:id` where the `:id` is an IMDb id. Auth-only routes (`/my-list`, `/my-learning*`, `/profile`) are wrapped in `<RequireAuth>`.

## Conventions

- Files are kebab-case (`video-player.tsx`, `use-stream-query.ts`); React components are PascalCase.
- Backend logging is structured Zap (`logger.Get()`); the router middleware logs every request with status-based level (≥500 error, ≥400 warn).
- CORS allow-list in `internal/middleware/cors.go` is hard-coded to `localhost:5173`/`:3000` — update it when changing the frontend origin.
