# 9Film

A personal streaming app that plays any IMDb title (HLS proxying, SubDL subtitles, TV episode selection) and layers an English-learning toolkit on top: vocabulary, AI definitions and translations, spelling/meaning self-tests, and SM-2 spaced repetition.

**Frontend** — React 19, TypeScript, Vite, Tailwind, Framer Motion, Video.js, TanStack Query
**Backend** — Go, Gin, Zap, SQLite (pure-Go driver, no CGO)

## Structure

```
backend/                 Go Gin API
├── cmd/api/main.go
└── internal/
    ├── app/             composition root
    ├── config/ database/ logger/ middleware/ cache/
    ├── clients/         third-party clients (httpx, subdl, opensubtitles, gemini)
    └── modules/         user, favorite, history, title, stream, subtitle, learning
web/                     React frontend
└── src/
    ├── components/      ui/ (Radix primitives) + system/ (feature components)
    ├── services/ hooks/ pages/ utils/
    └── ../vite.config.ts   proxies /api and /hls → backend:8081
```

Each backend module is a vertical slice (`repo.go` → `service.go` → `handler.go` → `route.go`, wired by `module.go`). See `CLAUDE.md` for the architecture in depth.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/title/:imdb`, `/api/title/:imdb/similar` | IMDb metadata via GraphQL |
| GET | `/api/title/search`, `/trending`, `/browse` | Discovery lists (cached 1h) |
| GET | `/api/stream` | Resolve stream URLs from the CDN |
| GET | `/hls` | HLS manifest/segment proxy with URL rewriting (mounted at root) |
| GET | `/api/subtitle/search`, `/api/subtitle/download` | Subtitle search / WebVTT download |
| GET | `/api/learn/define`, `/api/learn/translate` | Dictionary + translation helpers |
| * | `/api/me/*` | Local account: profile, settings, keys, favorites, history, words, tests, reviews |

## Getting started

Prerequisites: **Go 1.25+** and **Node 20+ with pnpm**. The two apps are independent — run them in separate terminals.

```bash
cd backend
make dev            # http://localhost:8081
```

```bash
cd web
pnpm install
pnpm dev            # http://localhost:5173
```

Vite proxies `/api` and `/hls` to the backend; point it elsewhere with `API_URL=http://host:port pnpm dev`. Other commands: `make build` / `make run` / `make tidy` / `go test ./...`; `pnpm build` / `pnpm typecheck` / `pnpm lint`.

The SQLite file (`./9film.db`) is created, migrated and seeded with the single local account on first run. `.env` is optional and holds no secrets — only `PORT`, `HOST` (loopback by default; set `HOST=0.0.0.0` only if you mean to expose it) and `DB_PATH`.

## No sign-in, and the two optional keys

The app is single-user by design: it runs on your machine against a local SQLite file, so the backend resolves one account at startup and every request runs as it. No login, no password, no token.

Both API keys are asked for once in the welcome flow at `/welcome` (which also carries the licence notice) and can be changed at `/profile` → Connections. They live in the database — the server ships with none and has no `.env` fallback. Both are skippable, and each feature degrades on its own:

- **SubDL** — no key means no subtitles; playback and everything else are unaffected.
- **Gemini** — powers idiom/phrase breakdowns and AI-graded meaning answers in self-tests. Without it, phrases fall back to a plain translation and meaning answers to a local string heuristic. Dictionary lookups and translations never touch Gemini — they use separate public APIs.
