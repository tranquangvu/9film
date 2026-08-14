# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Overview

9Film streams HLS video for any IMDb title id and layers an English-learning toolkit on top (vocabulary, self-tests, spaced repetition). A Go/Gin backend proxies every upstream so the browser never sees sources or credentials; a React 19 + Vite frontend consumes it. Two independent apps in `backend/` and `web/` — no root `package.json`.

**Single user, no sign-in.** The backend resolves one local account at startup and stamps every request with it (`middleware.LocalUser`). No login, no token, no session. `user_id` columns stay (they key every row) but always hold that one id.

## Commands

Backend (`cd backend`):
- `make dev` — API on `:8081` (`go run ./cmd/api/main.go`)
- `make build` / `make run` — binary at `bin/server`
- `make tidy`, `go test ./...`; single test: `go test ./internal/modules/learning -run TestName`

Frontend (`cd web`, **pnpm**):
- `pnpm dev` (`:5173`), `pnpm build`, `pnpm typecheck` (`tsc -b`), `pnpm lint`

Run both together; Vite proxies `/api` and `/hls` to `API_URL` (default `http://localhost:8081`).

## Backend architecture

### Module layout

Each feature is a vertical slice under `internal/modules/`: `repo.go` (data access) → `service.go` (logic) → `handler.go` (HTTP only) → `route.go` (`RegisterRoutes`) , wired by `module.go`; `model.go`/`dto.go` hold DB rows and frontend shapes. `Repository`/`Service` are interfaces so the layer above can mock them. Stateless proxy modules (`stream/`, `subtitle/`) have no repo or model.

Shared infrastructure sits directly under `internal/`: `config/`, `database/`, `logger/`, `middleware/`, `app/`, `cache/` (generic `cache.TTL[T]`, used only for user-independent upstream responses).

### Third-party clients

`internal/clients/` (`subdl/`, `opensubtitles/`, `gemini/`) **depend on nothing of ours** except their sibling `clients/httpx` — no gin, no app types, no domain vocabulary; each speaks its vendor's own shapes. `httpx` is the shared leaf (bounded GET, header helper, `httpx.ErrRateLimited`); nothing outside `clients/` imports it, and each client restates rate limiting as its own sentinel so modules match on vendor vocabulary, not transport.

Translation into app terms is a thin adapter in the consuming module: `modules/subtitle/subdl.go` implements `Provider`; `modules/learning/generator.go` owns the prompts and implements `Generator`. Each adapter declares a small private interface for the slice of the client it uses (`subdlAPI`, `osAPI`, `llm`) so its tests run against a stub.

### Composition root

`internal/app/app.go` loads config, opens SQLite, builds the Gin engine (`Logger`, `Recovery`, `CORS`), and calls each `Module(...)`. It builds `user.NewCredentialStore(db)` and injects per-user key resolvers (`geminiKeys`, `subtitleCreds`) into the optional integrations. `subtitleCreds` is keyed by *provider*, so an id from an unwired provider resolves to empty creds.

`title.Module` takes a `title.Enricher` so per-user state folds into title responses; `app.go` injects `history.NewEnricher(db)`, which forwards favorites to the `favorite` module.

### Modules

- `user/` — account, settings, per-user API keys (`credentials.go`)
- `favorite/` — watchlist; `GET /me/favorites` is paginated and hydrates a whole page in one batched IMDb request
- `history/` — watch progress, continue-watching, subtitle preference; hydrates via `title`, flags favorites, provides the `title.Enricher`
- `title/` — IMDb metadata via hand-written GraphQL against `api.graphql.imdb.com`; `titleCardFields`/`titleDetailFields` are composable field-set constants. Raw responses cache for 1h **before** per-user state folds in, so the cache stays user-independent. `FetchTitles`/`GetTitles` resolve many ids via `titles(ids:[...])`, batch-fetching only cache misses (chunked by `titleBatchSize`).
- `stream/`, `subtitle/`, `learning/` — see below

### Upstream integrations

1. **IMDb** — GraphQL (`modules/title/`).
2. **Stream resolution** (`stream.Stream`) — proxies `/api/stream` to `streamdata.vaplayer.ru` with the upstream `Referer`, returning `stream_urls` and, for TV, an `eps` season→episode map. `refererResolver` scrapes the embed page for its first `<iframe>` host at startup, refreshes every 6h, falls back to `embedRefererDefault`. Shared by `Stream` and `HLS`. Resolutions cache 1h by sorted query.
3. **HLS proxy** (`stream.HLS`) — the critical piece. `/hls?url=<absolute>` fetches an `.m3u8`/`.ts` with the required `Referer`, and for manifests **rewrites every URI** (segment lines and `URI="..."`) back through `/hls`, resolving relatives to absolute first. This keeps the whole playlist flowing through the backend so the CDN only ever sees the server's Referer. Mounted at the engine root, outside `/api` — `stream.Module` takes the engine as well as the `/api` group.

### Optional integrations (degrade gracefully)

**Subtitles** — `subtitle/` is a provider adapter, not one vendor. `provider.go` owns the `Provider` interface, `Creds`, `CredsResolver` and the opaque-id helpers; `vtt.go`/`archive.go` hold SRT→VTT and zip/gzip helpers; `Module` takes its providers already built, so `app.go` chooses them.
- `opensubtitles.go` is **kept but not wired in** — it compiles so it can't rot; its header comment lists the steps to re-wire it. An `opensubtitles:` id returns 400.
- Ids are opaque `"<provider>:<ref>"` (`subdl:/subtitle/x.zip|S01E02`) and flow to the browser and into `history.sub_ref`. Only the owning provider parses the ref — SubDL packs the requested `SxxEyy` in so a season-pack ZIP unpacks to the right episode. `ParseID` reads a bare numeric id as legacy OpenSubtitles so it fails cleanly.
- Key comes only from `user.CredentialStore`. Missing → 503 `code:"provider_key_missing"` (frontend shows the "no subtitles" notice); throttled → 429 `code:"provider_rate_limited"`.
- The frontend lists what the provider returned, in provider order (`utils/subtitle.ts` `listSubs`) — no sorting, filtering or top-N; only repeated ids are dropped.

**Gemini** (`gemini-2.5-flash`) powers exactly two things, both in `learning/`: phrase/idiom explanations (`GET /me/words/explain`, degrading to a plain translation) and AI-graded meaning answers in `POST /me/tests` (falling back to a local string heuristic). Dictionary definitions and translations are **not** Gemini — separate public APIs, no key needed. Client: `clients/gemini` (`Generate`/`GenerateJSONArray`/`GenerateJSONObject`, which dig the JSON out of fenced or prose-wrapped replies).

Both keys are **per-user only** — no `.env` fallback, the server holds no key of its own.

### Learning module

`/api/learn` (dictionary/translate helpers) and `/api/me/*` (word CRUD + import, per-word stats, explanations, tests, SRS reviews). Spaced repetition is SM-2 in `srs.go`, covered by `srs_test.go`.

### Config and the local account

`config.Config` is three values: `Port` (8081), `Host` (`127.0.0.1`, loopback because nothing authenticates the port), `DBPath` (`./9film.db`). No secrets — every credential lives in the DB, entered at Profile → Connections.

`user.LocalUserID(db)` resolves the account **by username** (`9film`, seeded by `database.Open`) and creates it if missing — by name rather than lowest id, because a pre-auth-removal database can hold several accounts and picking by id would silently switch to a stale one. So the username is **not editable**: `PUT /api/me` takes an avatar only. Renaming the seed strands every favorite, resume point and saved word on the old row — delete `9film.db` and start over instead.

`Migrate` is schema-only: `CREATE TABLE IF NOT EXISTS` plus the seed, no versioning and no in-place column migration. Changing a table means editing the CREATE and deleting the database file.

## Frontend architecture

Data flow: `utils/` (pure logic) → `services/` (fetch wrappers) → `hooks/` (TanStack Query) → `pages/`/`components/`. Components split into `components/ui/` (Radix primitives) and `components/system/` (by domain: `layout/`, `title/`, `player/`, `learn/`, `common/`). Services mirror the backend. Path alias `@/` → `web/src/`.

`utils/stream.ts`: `streamQuery` builds the `/api/stream` query (auto-detects `tt…` IMDb vs TMDB ids); `bestUrl` picks the playable stream (prefers `master.m3u8`, avoids `justhd.tv`); `mergeEpisode`/`seasons`/`episodes` drive TV episode selection from `eps`.

`components/system/player/video-player.tsx` routes `.m3u8` through `/hls` **only in dev** (`import.meta.env.DEV`), raw src otherwise — the seam to check when streams play locally but not in production.

### Onboarding and the API keys

First-run flow at `/welcome` (`pages/onboarding-page.tsx`): step one the licence notice, step two the SubDL and Gemini keys. Both fields are skippable; finishing sets `9film:onboarded` in localStorage via `hooks/use-onboarding.ts` — a `useSyncExternalStore` module store, because the gate and the flow are sibling subtrees and completing one must unblock the other without a reload.

`OnboardingGate` wraps every app route and redirects to `/welcome` with the attempted path in `location.state.from`. `/welcome`, `/about` and `/disclaimer` sit **outside** the gate — step one links to Disclaimer in a new tab, which the gate would otherwise bounce back.

A skipped key is raised again only where it mattered: `useMissingKey(kind, using)` pairs credential status with the caller's "using it now" signal, once per browser session. The watch page renders a dismissible `SubtitleKeyNotice` banner (the film plays fine without captions); the word popup renders `MissingKeyDialog`. All of these plus the Profile → Connections form read their wording from `KEY_COPY` (`components/system/common/key-copy.ts`), so an integration is never explained two different ways.

### Routing

`app.tsx` / `createBrowserRouter`. `MainLayout` wraps browsing/learning pages, `WatchLayout` wraps `/watch/:id`, detail pages are `/title/:id` (IMDb id). The only guard is `OnboardingGate`, and it gates on a localStorage flag, not an account.

## Conventions

- Files kebab-case (`video-player.tsx`, `use-stream-query.ts`); React components PascalCase.
- Backend logging is structured Zap (`logger.Get()`); request middleware picks level by status (≥500 error, ≥400 warn).
- CORS allow-list in `internal/middleware/cors.go` is hard-coded to `localhost:5173`/`:3000` — update it when changing the frontend origin.
