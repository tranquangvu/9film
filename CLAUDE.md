# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NiceFilm streams real HLS video for any IMDb title ID and layers an English-learning toolkit on top (vocabulary, spelling/meaning self-tests, spaced-repetition review). A Go/Gin backend acts as a proxy that hides upstream sources and credentials from the browser; a React 19 frontend (Vite) consumes it. Two independent apps in `backend/` and `web/` — there is no root `package.json`.

**It runs on one person's machine and has no sign-in.** The backend resolves a single local account at startup and stamps every request with it (`middleware.LocalUser`), so there is no login, no token and no session anywhere in either app. The `user_id` columns stay — they are the key of every row — but they always hold that one id.

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

### Third-party clients

Every vendor SDK-ish client lives under `internal/clients/`: `subdl/`, `opensubtitles/`, `gemini/`. **They depend on nothing of ours** (only their sibling `clients/httpx`) — no gin, no app types, no domain vocabulary. Each speaks its vendor's own shapes: `subdl.Search` returns `[]subdl.Subtitle`, `gemini.Generate` returns text.

`clients/httpx/` is the shared leaf of that tree: a bounded GET, a header helper, and `httpx.ErrRateLimited`. Nothing outside `clients/` imports it — each client restates the throttling condition as its own sentinel (`subdl.ErrRateLimited`, `opensubtitles.ErrRateLimited`, wrapped with `%v` so the httpx chain stops there), so the modules above match on vendor vocabulary instead of on a transport detail.

The translation into app terms is a thin adapter in the module that consumes it:
- `modules/subtitle/subdl.go` and `modules/subtitle/opensubtitles.go` implement `Provider` over the clients — minting the opaque ids, building labels, turning an archive into WebVTT, restating each client's `ErrRateLimited` as `subtitle.ErrRateLimited` via the shared `rateLimited(err, limit)` helper in `provider.go`.
- `modules/learning/generator.go` owns the prompts and implements `Generator` over `gemini.Client`.

Each adapter declares a small private interface for the slice of the client it uses (`subdlAPI`, `osAPI`, `llm`), so adapter tests run against a stub instead of the network.

### Composition root

`internal/app/app.go` loads config, opens the SQLite DB, builds the Gin engine with global middleware (`Logger`, `Recovery`, `CORS`), and calls each module's `Module(...)`. It also builds a `user.NewCredentialStore(db)` and passes per-user-key resolvers into the optional integrations (see below).

Cross-module seams are kept thin:
- `title.Module` receives a `title.Enricher` so per-user state (favorites, watch progress, chosen subtitle) folds into title responses. `app.go` injects `history.NewEnricher(db)`, which satisfies the interface directly and forwards `FavoritedIds` to the `favorite` module — no adapter needed.
- `learning.Module` and `subtitle.Module` receive small key-resolver structs defined in `app.go` (`geminiKeys`, `subtitleCreds`). Both resolve the user's stored key only — there is no `.env` fallback for either, and the server holds no key of its own. `subtitleCreds` stays keyed by *provider* so an id from an unwired provider resolves to empty creds.

### Modules

- `user/` — accounts, settings, and per-user API keys (`credentials.go` / `CredentialStore`) for the optional integrations
- `favorite/` — watchlist; `GET /me/favorites` is paginated and embeds each title's detail server-side (imports `title`, hydrates a whole page in one batched IMDb request — same shape as continue-watching) so the My List grid needs no per-title lookups
- `history/` — watch progress, continue-watching, subtitle preference; imports `title` to hydrate (one batched request per page) and `favorite` to flag favorites; provides the `title.Enricher`
- `title/` — IMDb metadata (`service.go`/`repo.go` query `api.graphql.imdb.com` with hand-written GraphQL; `titleCardFields`/`titleDetailFields` are composable field-set constants reused across popular/trending/search/browse/similar/detail). Go structs mirror the GraphQL shape, then flatten into a `Title` DTO. The repo caches raw IMDb responses (single title, search/trending lists, browse pages) with a 1h TTL — *before* the service folds in per-user favorites/progress, so the cache stays user-independent. `FetchTitle`/`GetTitle` resolve one id; `FetchTitles`/`GetTitles` resolve many via IMDb's `titles(ids:[...])`, checking the cache first and batch-fetching only the misses (chunked by `titleBatchSize`) — used by the favorite/history page hydration.
- `stream/` — stream resolution + HLS proxy (see below)
- `subtitle/` — subtitle search/download behind a provider adapter (optional; see below)
- `learning/` — vocabulary, AI definitions/translations, self-tests, spaced repetition (see below)

### The three upstream integrations

1. **IMDb metadata** (`modules/title/`) — GraphQL against `api.graphql.imdb.com`.

2. **Stream resolution** (`modules/stream/service.go`, the `Stream` type) — proxies `/api/stream?...` to `streamdata.vaplayer.ru`, injecting the upstream `Referer`. Returns JSON with `stream_urls` and, for TV, an `eps` season→episode map. The Referer is discovered by `refererResolver`: it scrapes the embed page (`vaplayer.ru/embed/movie/...`) for its first `<iframe>` host once at startup (synchronously), then refreshes every 6h via a background ticker, falling back to `embedRefererDefault` when discovery fails. One resolver is shared by `Stream` and `HLS`. Successful stream resolutions are cached by query (sorted) with a 1h TTL.

3. **HLS proxy** (`modules/stream/service.go`, the `HLS` type) — the most important piece. `/hls?url=<absolute>` fetches an `.m3u8` or `.ts` with the required `Referer`. For manifests it **rewrites every URI** (segment lines and `URI="..."` attributes) back through `/hls`, resolving relative URLs to absolute first. This recursively keeps the whole playlist flowing through the backend so the CDN only ever sees the server's Referer, never the browser's. `/hls` is mounted at the engine root (outside `/api`), so `stream.Module` takes the engine as well as the `/api` group.

### Optional integrations (degrade gracefully)

- **Subtitles** — `subtitle/` is a provider adapter, not one vendor. `provider.go` owns the `Provider` interface (`Name`/`Search`/`DownloadVTT`), `Creds`, the per-provider `CredsResolver`, and the opaque-id helpers; `subdl.go` adapts `clients/subdl` and is the one implementation wired in; `vtt.go`/`archive.go` hold the shared SRT→VTT and zip/gzip helpers. `service.go` resolves creds and dispatches. `Module` takes its providers already built, so `app.go` chooses them.
  - `opensubtitles.go` (and `clients/opensubtitles`) is **kept but not wired in**: `app.go` passes SubDL alone, no credentials reach it, and an `opensubtitles:` id returns 400 "unknown provider". Both files compile so they can't rot; the adapter's header comment lists the three steps to wire it back in.
  - Subtitles are identified by an **opaque `"<provider>:<ref>"` id** (`subdl:/subtitle/x.zip|S01E02`) that flows all the way to the browser and into `history.sub_ref`. Only the owning provider parses the ref — SubDL packs the requested `SxxEyy` into it so a season-pack ZIP can be unpacked to the right episode. `ParseID` still reads a bare numeric id as a legacy OpenSubtitles one so it fails cleanly rather than being taken for a SubDL ref, and `Migrate` backfills old `history.sub_file_id` rows into `sub_ref`.
  - The SubDL key comes only from `user.CredentialStore` — there is no `.env` fallback and the server holds no key of its own. With none stored the handler returns 503 `code:"provider_key_missing"`, which the frontend turns into the watch page's "no subtitles" notice; a throttled account returns 429 `code:"provider_rate_limited"`.
  - The frontend lists what the provider returned, in provider order (`utils/subtitle.ts` `listSubs`) — no sorting, language filtering, release-name matching or top-N cut. Only a repeated id is dropped, since a SubDL season pack yields one row per release but a single archive.
- **Gemini** (default model `gemini-2.5-flash`) — powers exactly two things, both in the learning module: phrase/idiom explanations (`GET /me/words/explain`, which degrades to a plain machine translation when there's no key or the call fails) and AI-graded meaning answers inside a submitted self-test (`POST /me/tests`, which falls back to a local string heuristic against the saved translation). Dictionary definitions and translations are *not* Gemini — they hit separate public APIs and work without any key. The client is `clients/gemini` (`Generate` / `GenerateJSONArray` / `GenerateJSONObject`, which find the JSON inside a fenced or prose-wrapped reply); the prompts live in `modules/learning/generator.go`. **Per-user only**: the key comes solely from `user.CredentialStore` — there is no `.env`/server-side fallback, so the server reads no `GEMINI_API_KEY`.

### Learning module

Routes under `/api/learn` (dictionary/translate helpers) and `/api/me/*` (the local account's data): word list CRUD + import, per-word stats, phrase/idiom explanation, test submission/history, and SRS reviews. Spaced repetition uses the SM-2 algorithm in `srs.go` (covered by `srs_test.go`).

Config (`internal/config/config.go`) is down to three values: `Port` (8081), `Host` (`127.0.0.1` — loopback because nothing authenticates the port), and `DBPath` (`./nicefilm.db`). No API keys and no secrets: every credential lives in the database, entered through Profile → Connections.

`user.LocalUserID(db)` resolves the account by username (`9film`, the one `database.Open` seeds) and creates it if missing. The username is therefore **not editable** — `PUT /api/me` takes an avatar and nothing else (`Service.UpdateAvatar`), because a rename would strand every row on the old account while the seed re-created the original name on the next boot. It matches on the name rather than the lowest id because a database from before auth was removed can hold several accounts, and picking by id would silently switch to a stale one's history and keys.

That makes the seeded username load-bearing: renaming it means adding an `UPDATE users SET username = …` to `Migrate` *before* the seed, or the next boot inserts a fresh empty account and leaves every favorite, resume point and saved word behind on the old row. The `iami` → `9film` rename in `sqlite.go` is the worked example.

## Frontend architecture

Data flow: `utils/` (pure logic) → `services/` (fetch wrappers) → `hooks/` (TanStack Query) → `pages/`/`components/`.

Key utilities in `utils/stream.ts`:
- `streamQuery` builds the `/api/stream` query, auto-detecting IMDb (`tt…`) vs TMDB ids.
- `bestUrl` picks the playable stream (prefers `master.m3u8`, avoids `justhd.tv`).
- `mergeEpisode`/`seasons`/`episodes` drive TV episode selection from the `eps` map.

`components/system/player/video-player.tsx` decides playback: HLS sources (`.m3u8`) route through `/hls` **only in dev** (`import.meta.env.DEV`); otherwise the raw src is used. This mirrors the backend HLS rewriting and is the seam to check when streams play locally but not in production.

Components split into `components/ui/` (Radix-based primitives) and `components/system/` (feature components grouped by domain: `layout/`, `title/`, `player/`, `learn/`, `common/`). Services mirror the backend: `title.ts`, `stream.ts`, `subtitle.ts`, `user.ts`, `learn.ts`, `dictionary.ts`. Path alias `@/` → `web/src/`.

### Onboarding and the API keys

Both keys are asked for once, up front, in the first-run flow at `/welcome` (`pages/onboarding-page.tsx`): step one is the licence notice (no licence, nothing hosted, personal non-commercial — it used to sit in front of the first playback), step two explains and collects the SubDL and Gemini keys. Both fields are skippable; finishing sets `9film:onboarded` in localStorage through `hooks/use-onboarding.ts` — a `useSyncExternalStore` module store, because the gate and the flow are sibling subtrees and completing one must unblock the other without a reload.

`OnboardingGate` (`components/system/common/onboarding-gate.tsx`) wraps every app route and redirects to `/welcome` with the attempted path in `location.state.from`. `/welcome` and the static `/about` + `/disclaimer` pages sit **outside** the gate — step one links to Disclaimer in a new tab, which the gate would otherwise bounce back into the flow.

After onboarding, a skipped key is raised again only where it would have mattered: `useMissingKey(kind, using)` (`hooks/use-missing-key.ts`) pairs the credential status with the caller's "using it right now" signal, once per browser session. The watch page passes `subtitleKeyMissing` (the 503 from the subtitle search) and renders `SubtitleKeyNotice` — a dismissible banner under the player header, not a dialog, since the film plays fine without captions; the word popup passes `isPhrase` and renders `MissingKeyDialog`. Every one of these surfaces (plus the Profile → Connections form) reads its wording from `KEY_COPY` in `components/system/common/key-copy.ts`, so an integration is never explained two different ways.

### Routing

Routes are defined in `app.tsx` via `createBrowserRouter`. `MainLayout` wraps the browsing/learning pages; `WatchLayout` wraps `/watch/:id`. Detail pages use `/title/:id` where the `:id` is an IMDb id. There is nothing to sign in to, so the only guard is `OnboardingGate` (see above) — and it gates on a localStorage flag, not on an account.

## Conventions

- Files are kebab-case (`video-player.tsx`, `use-stream-query.ts`); React components are PascalCase.
- Backend logging is structured Zap (`logger.Get()`); the router middleware logs every request with status-based level (≥500 error, ≥400 warn).
- CORS allow-list in `internal/middleware/cors.go` is hard-coded to `localhost:5173`/`:3000` — update it when changing the frontend origin.
