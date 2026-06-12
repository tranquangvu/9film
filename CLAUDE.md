# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NiceFilm streams real HLS video for any IMDb title ID. A Go/Gin backend acts as a proxy layer that hides upstream sources and credentials from the browser; a React 19 frontend (Vite) consumes it. Two independent apps in `backend/` and `web/` — there is no root `package.json`.

## Commands

Backend (`cd backend`):
- `make dev` — run API on `:8081` (`go run ./cmd/server/main.go`)
- `make build` / `make run` — build to `bin/server` and run
- `make tidy` — `go mod tidy`
- Single test: `go test ./internal/service -run TestName` (no tests exist yet)

Frontend (`cd web`, uses **pnpm**):
- `pnpm dev` — Vite dev server on `:5173`
- `pnpm build` — production build
- `pnpm typecheck` — `tsc -b` (no-emit type check)
- `pnpm lint` — ESLint

Run both apps simultaneously for development; Vite proxies `/api` and `/proxy` to `API_URL` (default `http://localhost:8081`), so the browser never calls the backend directly.

## Architecture

### Backend is a proxy, not a content store

The backend owns three upstream integrations and exists to add auth headers, rewrite responses, and dodge browser CORS/Referer restrictions. Each integration is one file in `internal/service/` with a thin `internal/handler/` wrapper; routes are registered in `internal/router/router.go`.

1. **IMDb metadata** (`service/imdb.go`) — queries `api.graphql.imdb.com` with hand-written GraphQL. `titleCardFields`/`titleDetailFields` are composable field-set constants reused across popular/trending/search/browse/similar/detail queries. Go structs mirror the GraphQL shape, then flatten into a `Title` DTO for the frontend.

2. **Stream resolution** (`service/stream.go`) — proxies `/api/stream?...` to `streamdata.vaplayer.ru`, injecting a hard-coded `Referer` (`embedReferer` in `service/hls.go`). Returns JSON containing `stream_urls` and, for TV, an `eps` season→episode map.

3. **HLS proxy** (`service/hls.go`) — the most important piece. `/proxy/hls?url=<absolute>` fetches an `.m3u8` or `.ts` segment with the required `Referer`. For manifests it **rewrites every URI** (segment lines and `URI="..."` attributes) to point back through `/proxy/hls`, resolving relative URLs to absolute first. This recursively keeps the entire HLS playlist flowing through the backend so the CDN only ever sees the server's Referer, never the browser's.

OpenSubtitles (`service/subtitle.go`) is optional — disabled entirely when `OPENSUBTITLES_API_KEY` is unset (see `config.Load`). Handlers that need credentials are constructed with `cfg` (e.g. `handler.SearchSubtitles(cfg)`).

### Frontend data flow

`utils/` (pure logic) → `services/` (fetch wrappers) → `hooks/` (TanStack Query) → `pages/`/`components/`. Key utilities in `utils/stream.ts`:
- `streamQuery` builds the `/api/stream` query, auto-detecting IMDb (`tt…`) vs TMDB ids.
- `bestUrl` picks the playable stream (prefers `master.m3u8`, avoids `justhd.tv`).
- `mergeEpisode`/`seasons`/`episodes` drive TV episode selection from the `eps` map.

`components/system/player/video-player.tsx` decides playback: HLS sources (`.m3u8`) route through `/proxy/hls` **only in dev** (`import.meta.env.DEV`); otherwise the raw src is used. This mirrors the backend HLS rewriting and is the seam to check when streams play locally but not in production.

Components split into `components/ui/` (Radix-based primitives) and `components/system/` (feature components grouped by domain: `layout/`, `movie/`, `player/`, `common/`). Path alias `@/` → `web/src/`.

### Routing note

App routes use `:id` (`/watch/:id`, `/movie/:id`) — the README's `/watch/:imdb` examples still work since the id *is* an IMDb id, but the param name in code is `id`.

## Conventions

- Files are kebab-case (`video-player.tsx`, `use-stream-query.ts`); React components are PascalCase.
- Backend logging is structured Zap (`logger.Get()`); the router middleware logs every request with status-based level (≥500 error, ≥400 warn).
- CORS allow-list in `router.go` is hard-coded to `localhost:5173`/`:3000` — update it when changing the frontend origin.
