# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Overview

HLS streaming for any IMDb title id, plus an English-learning toolkit (vocabulary, self-tests, spaced repetition). The Go/Gin backend proxies every upstream so the browser never sees a source or a credential; a React 19 + Vite frontend consumes it. `backend/` and `web/` are independent apps — no root `package.json`. `desktop/` packages both as a macOS app.

**Single user, no sign-in.** `middleware.LocalUser` stamps every request with the one local account. `user_id` columns stay (they key every row) but always hold that id.

## Commands

- Backend (`cd backend`): `make dev` (:8081), `make build` / `run` / `tidy`, `go test ./...`; one test: `go test ./internal/modules/learning -run TestName`
- Frontend (`cd web`, **pnpm**): `pnpm dev` (:5173), `build`, `typecheck` (`tsc -b`), `lint`
- Desktop (`cd desktop`, macOS + Wails v2 CLI): `make dev`, `make build`, `make dmg`
- Docker (repo root): `docker compose up -d --build` → :8080

Vite proxies `/api` and `/hls` to `API_URL` (default `http://localhost:8081`).

## Backend

**Module layout** — vertical slices under `internal/modules/`: `repo.go` → `service.go` → `handler.go` → `route.go`, wired by `module.go`; `model.go`/`dto.go` hold DB rows and frontend shapes. `Repository`/`Service` are interfaces so the layer above can mock them. `stream/` and `subtitle/` are stateless — no repo, no model. Shared infra sits directly under `internal/`: `config/`, `database/`, `logger/`, `middleware/`, `app/`, `cache/` (`cache.TTL[T]`, for user-independent upstream responses only).

**Clients** — `internal/clients/{subdl,opensubtitles,gemini}` depend on nothing of ours but their sibling `clients/httpx` (bounded GET, header helper, `ErrRateLimited`); each speaks its vendor's shapes and restates rate limiting as its own sentinel, so modules match on vendor vocabulary rather than transport. Nothing outside `clients/` imports `httpx`. Translation into app terms is a thin adapter in the consuming module (`modules/subtitle/subdl.go`, `modules/learning/generator.go`), each declaring a small private interface (`subdlAPI`, `osAPI`, `llm`) so its tests run against a stub.

**Composition root** — `internal/app/app.go`: config, SQLite, the Gin engine (`Logger`, `Recovery`, `CORS`), then each `Module(...)`. It injects per-user key resolvers (`geminiKeys`, `subtitleCreds`) built on `user.NewCredentialStore`; `subtitleCreds` is keyed by *provider*, so an id from an unwired provider resolves to empty creds. `title.Module` takes a `title.Enricher` — `history.NewEnricher(db)` — so per-user state folds into title responses.

**Modules** — `user/` (account, settings, per-user keys), `favorite/` (paginated; a page hydrates in one batched IMDb request), `history/` (progress, continue-watching, subtitle preference; provides the `Enricher`), `title/`, `stream/`, `subtitle/`, `learning/`.

**Upstreams**

- IMDb — hand-written GraphQL in `modules/title/`; `titleCardFields`/`titleDetailFields` are composable field sets. Raw responses cache 1h **before** per-user state folds in, so the cache stays user-independent. `FetchTitles`/`GetTitles` resolve many ids via `titles(ids:[...])`, fetching only cache misses (chunked by `titleBatchSize`).
- `stream.Stream` — `/api/stream` → `streamdata.vaplayer.ru` with the upstream `Referer`; returns `stream_urls` and, for TV, an `eps` season→episode map. `refererResolver` scrapes the embed page's first `<iframe>` host at startup, refreshes every 6h, falls back to `embedRefererDefault`. Cached 1h by sorted query.
- `stream.HLS` — `/hls?url=<absolute>` fetches an `.m3u8`/`.ts` with that `Referer` and, for manifests, **rewrites every URI** (segment lines and `URI="..."`, relatives resolved to absolute first) back through `/hls`, so the CDN only ever sees the server. Mounted at the engine root, outside `/api` — `stream.Module` takes the engine as well as the `/api` group.

**Optional integrations** — both keys are per-user only (no `.env` fallback, the server holds none), and each feature degrades on its own.

- Subtitles — `subtitle/` is a provider adapter, not one vendor: `provider.go` (the `Provider` interface, `Creds`, opaque-id helpers), `vtt.go`/`archive.go` (SRT→VTT, zip/gzip); `Module` takes its providers already built, so `app.go` chooses them. Ids are opaque `"<provider>:<ref>"` (`subdl:/subtitle/x.zip|S01E02`) and flow to the browser and into `history.sub_ref`; only the owning provider parses the ref — SubDL packs the requested `SxxEyy` so a season-pack ZIP unpacks to the right episode. `ParseID` reads a bare numeric id as legacy OpenSubtitles so it fails cleanly. `opensubtitles.go` compiles but is **not wired in** (its header lists the re-wiring steps); that id returns 400. Missing key → 503 `provider_key_missing`, throttled → 429 `provider_rate_limited`. The frontend lists what the provider returned, in provider order (`utils/subtitle.ts`), dropping only repeated ids.
- Gemini (`gemini-2.5-flash`) — exactly two things, both in `learning/`: phrase explanations (`GET /me/words/explain`, degrading to a plain translation) and AI-graded meaning answers (`POST /me/tests`, falling back to a local string heuristic). Dictionary definitions and translations are **not** Gemini — separate public APIs, no key. `clients/gemini` digs the JSON out of fenced or prose-wrapped replies.

**Learning** — `/api/learn` (dictionary/translate helpers) and `/api/me/*` (word CRUD + import, stats, explanations, tests, reviews). SM-2 lives in `srs.go`, covered by `srs_test.go`.

**Config and the local account** — `config.Config` is `Port` (8081), `Host` (127.0.0.1, because nothing authenticates the port) and `DBPath` (`./9film.db`). No secrets; every credential lives in the DB. `user.LocalUserID(db)` resolves the seeded `9film` account **by username**, not lowest id — a pre-auth-removal database can hold several accounts and picking by id would silently switch to a stale one. So the username is not editable (`PUT /api/me` takes an avatar only): renaming the seed strands every favorite, resume point and saved word on the old row. `Migrate` is schema-only (`CREATE TABLE IF NOT EXISTS` plus the seed) — changing a table means editing the CREATE and deleting the database file.

## Frontend

`utils/` (pure logic) → `services/` (fetch wrappers) → `hooks/` (TanStack Query) → `pages/`/`components/`. Components split into `components/ui/` (Radix primitives) and `components/system/` (`layout/`, `title/`, `player/`, `learn/`, `common/`). Alias `@/` → `web/src/`.

- `utils/stream.ts` — `streamQuery` (auto-detects `tt…` IMDb vs TMDB ids), `bestUrl` (prefers `master.m3u8`, avoids `justhd.tv`), `mergeEpisode`/`seasons`/`episodes` for TV.
- `player/video-player.tsx` routes every `.m3u8` through `/hls`, prefixed with `apiOrigin` (`utils/desktop.ts`, empty outside the desktop build). Never hand a raw `.m3u8` to the player — the CDN rejects it without the upstream `Referer`.
- Onboarding — `/welcome`: licence notice, then the two keys. Finishing sets `9film:onboarded` via `hooks/use-onboarding.ts`, a `useSyncExternalStore` module store, because the gate and the flow are sibling subtrees and one must unblock the other without a reload. `OnboardingGate` wraps every app route; `/welcome`, `/about` and `/disclaimer` sit outside it. A skipped key is raised again only where it mattered — `useMissingKey(kind, using)`, once per session: `SubtitleKeyNotice` on the watch page, `MissingKeyDialog` in the word popup. All wording, that form included, comes from `KEY_COPY` (`components/system/common/key-copy.ts`).
- Routing — `app.tsx` / `createBrowserRouter`; `MainLayout` for browsing/learning, `WatchLayout` for `/watch/:id`, details at `/title/:id`. `OnboardingGate` is the only guard, and it gates on localStorage, not an account.

## Desktop (`desktop/`)

A Wails v2 module with its own `go.mod` (`replace … /backend => ../backend`). It imports `backend/server` (`New`/`Handler`/`Close`), which exists because `internal/` is unreachable from another module.

The same `*gin.Engine` is served two ways, both load-bearing: the **asset-server middleware** (`server.go`) handles `/api/*` and `/hls` on the frontend's own origin (so relative paths work untouched), serves `index.html` for extensionless navigations, and injects `window.__9FILM_API__`; a **real loopback listener** (8081 if free, else ephemeral) exists only for the `<video>` HLS src, since WKWebView hands media to AVFoundation, which can't resolve the `wails://` scheme. The port isn't fixed, hence the injection.

Constraints:

- `//go:embed` can't cross `..`, so `frontend-build` copies `web/dist` into `desktop/dist`; `dist/.gitkeep` is tracked so the embed compiles before anyone builds the frontend.
- Wails **execs** `frontend:*` without a shell (no env prefixes, no `&&`) from `web/`, so both hooks are `make -C ../desktop` targets — that's where `VITE_DESKTOP=1` and the copy live, and the extra layer shuts down cleanly when Wails kills the process group.
- Builds pass `-skipbindings`: Wails generates bindings by *running* the binary, which would open the database mid-build.
- `gin.SetMode` is called in `backend/server` — gin latches `GIN_MODE` at package init, long before the desktop process could set it.
- The DB is at `~/Library/Application Support/9film/9film.db`, created by `desktop/server.go` (`database.Open` does not `MkdirAll`). `OnShutdown` is the only thing that closes it, and so the only thing that checkpoints the WAL.
- Chrome is `mac.TitleBarHiddenInset()`; the frontend half is CSS keyed on `.is-desktop` (`web/src/index.css`): `app-titlebar` (draggable), `titlebar-lead` (inset past the traffic lights), `titlebar-row` (48px, so it centres on lights macOS fixes 24pt below the window top), `titlebar-drag-fill`. `--wails-draggable` inherits, so interactive children are opted back out by the `:where(...)` rule.
- `.is-desktop` needs **both** `VITE_DESKTOP` and the injected `window.__9FILM_API__`: `wails dev` runs one Vite server for both sides, so a browser at :5173 would otherwise wear window chrome with no window around it.

## Docker

Two multi-stage images. `backend/Dockerfile`: `golang:1.25-alpine` → `alpine`, `CGO_ENABLED=0` (modernc sqlite is pure Go), so the runtime layer is the binary plus `ca-certificates` and `tzdata`; uid 10001, with `/data` chowned in the image so the named volume inherits it; healthcheck hits `/api/me` — no dedicated health route, and it proves the database opened. `web/Dockerfile`: `node:24-alpine` (pnpm pinned, not corepack) → `nginx:alpine`, `VITE_DESKTOP` left unset so every `/api` and `/hls` path stays relative.

`web/nginx.conf` (+ `web/proxy.inc` — deliberately not `*.conf`, or nginx's `conf.d/*.conf` glob would pull proxy directives into the http block):

- One origin for API and assets, so `middleware.CORS`'s allow-list never needs a deploy host.
- `proxy_pass` goes through a **variable** with `resolver 127.0.0.11 valid=10s`: a literal upstream name resolves once at startup and would strand nginx on a dead IP after `api` restarts. The variable form drops the original URI, hence the explicit `$request_uri`.
- `location = /hls` with `proxy_buffering off` and a 300s read timeout — segments stream, not spool.
- `try_files $uri $uri/ /index.html`; `index.html` is `no-store`, `/assets/` immutable for a year.

The api port is not published — nginx is the only door. Compose takes no env input (the port and `TZ` are literals) and declares no healthchecks: both images carry their own, and `depends_on: service_healthy` reads the api image's, so nginx starts only once the backend answers. `cmd/api` has no signal handling; SIGTERM ends it without `db.Close()`, which is safe because SQLite replays the WAL on the next open.

## Conventions

- Files kebab-case (`video-player.tsx`, `use-stream-query.ts`); React components PascalCase.
- Structured Zap logging (`logger.Get()`); request middleware picks level by status (≥500 error, ≥400 warn).
- CORS matches an origin allow-list *by function*, not `cors.Config.AllowOrigins` — that field panics on any scheme outside http/https. The packaged macOS app loads from `wails://wails.localhost` but sends `Origin: wails://wails`: WebKit drops the `.localhost` when serializing a non-special scheme's origin. Both hosts are allowed — miss the bare one and the loopback HLS request 403s, surfacing only as "a network error status (0) occured while loading manifest".
