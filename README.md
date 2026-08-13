# 9Film - NiceFilm

A streaming app built with React on the frontend and Go on the backend. It streams real video from any IMDb title ID (HLS proxying, SubDL subtitles, TV episode selection) and layers an English-learning toolkit on top — vocabulary, AI definitions/translations, spelling and meaning self-tests, and SM-2 spaced-repetition review.

## Stack

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Video.js, TanStack Query
**Backend** — Go, Gin, Zap, SQLite, godotenv

## Project Structure

```
9film/
├── backend/                       Go Gin API
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── app/                   composition root (wires modules)
│   │   ├── config/                env loading
│   │   ├── database/              SQLite open + migrations
│   │   ├── logger/                zap setup
│   │   ├── middleware/            CORS, local-user identity, logging, recovery
│   │   ├── cache/                 generic TTL cache
│   │   ├── clients/               third-party clients (no app types)
│   │   │   ├── httpx/             bounded GET shared by the clients
│   │   │   ├── subdl/             SubDL subtitle API
│   │   │   ├── opensubtitles/     OpenSubtitles API (kept, not wired in)
│   │   │   └── gemini/            Gemini generateContent
│   │   └── modules/               vertical-slice features
│   │       ├── user/              the local account, settings, API keys
│   │       ├── favorite/          watchlist
│   │       ├── history/           watch progress, continue-watching
│   │       ├── title/             IMDb metadata (GraphQL)
│   │       ├── stream/            stream resolution + HLS proxy
│   │       ├── subtitle/          Provider contract + adapters (optional)
│   │       └── learning/          vocabulary, AI prompts, tests, SRS
│   ├── .env.example
│   └── Makefile
├── web/                           React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                Radix-based primitives
│   │   │   └── system/            feature components (layout, title, player, learn, common)
│   │   ├── services/              fetch wrappers (title, stream, subtitle, user, learn)
│   │   ├── hooks/                 TanStack Query hooks
│   │   ├── pages/                 route-level components
│   │   └── utils/                 stream/subtitle/HLS pure logic
│   └── vite.config.ts             proxies /api and /hls → backend:8081
└── README.md
```

Each backend module follows a layered layout (`repo.go` → `service.go` → `handler.go` → `route.go`, wired by `module.go`). See `CLAUDE.md` for the architecture in depth.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/title/:imdb`, `/api/title/:imdb/similar` | IMDb title metadata via GraphQL |
| GET | `/api/title/search`, `/trending`, `/browse` | Discovery lists (cached 1h) |
| GET | `/api/stream` | Resolve stream URLs from the CDN |
| GET | `/hls` | HLS segment/manifest proxy with URL rewriting (mounted at root) |
| GET | `/api/subtitle/search`, `/api/subtitle/download` | Subtitle search / WebVTT download (optional) |
| GET | `/api/learn/define`, `/api/learn/translate` | Dictionary + translation helpers |
| * | `/api/me/*` | The local account: profile, settings, API keys, favorites, history, words, tests, SRS reviews |

## Getting Started

### Prerequisites

- **Go 1.25+** — the SQLite driver is pure Go (`modernc.org/sqlite`), so no C toolchain or CGO is needed
- **Node 20+** and **pnpm** (`corepack enable pnpm` or `npm i -g pnpm`)

The two apps are independent — there is no root `package.json`. Run them in separate terminals.

### 1. Backend

```bash
cd backend
cp .env.example .env       # optional — the defaults work as-is
make dev                   # http://localhost:8081
```

The SQLite file (`./nicefilm.db` by default) is created and migrated automatically on first run, along with the single local account the app runs as.

`.env` has no required values and holds no secrets:

```env
# Server
PORT=8081
# Loopback by default. There is no sign-in, so only expose it on the network
# if you mean to (HOST=0.0.0.0).
HOST=127.0.0.1

DB_PATH=./nicefilm.db
```

Other backend commands: `make build` / `make run` (binary at `bin/server`), `make tidy`, `go test ./...`.

**No sign-in.** The app is single-user by design: it runs on your machine against a local SQLite file, so the backend resolves one account at startup and every request runs as it. There is no login page, no password and no token.

**API keys for the optional integrations.** Both keys are entered at `/profile` → Connections and stored in the database — the server ships with none, so nothing is configured behind your back. Each feature prompts for its key the first time you use it, once per session, and works or degrades without it:

- **SubDL** (subtitles) — no key means no subtitles. Everything else, including playback, is unaffected.
- **Gemini** — powers idiom/phrase breakdowns and AI-graded meaning answers in a self-test. Without a key a phrase falls back to a plain translation and meaning answers are graded by a local string heuristic. Dictionary lookups and translations never touch Gemini at all — they use separate public APIs.

### 2. Frontend

```bash
cd web
pnpm install
pnpm dev                   # http://localhost:5173
```

Vite proxies `/api` and `/hls` to `http://localhost:8081`, so the browser never calls the backend directly. Point it elsewhere with `API_URL=http://host:port pnpm dev`.

Other frontend commands: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm preview`.
