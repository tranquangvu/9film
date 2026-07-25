# 9Film - NiceFilm

A streaming app built with React on the frontend and Go on the backend. It streams real video from any IMDb title ID (HLS proxying, OpenSubtitles subtitles, TV episode selection) and layers an English-learning toolkit on top — vocabulary, AI definitions/translations, spelling and meaning self-tests, and SM-2 spaced-repetition review.

## Stack

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Video.js, TanStack Query
**Backend** — Go, Gin, Zap, SQLite, JWT, godotenv

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
│   │   ├── middleware/            CORS, auth, logging, recovery
│   │   └── modules/               vertical-slice features
│   │       ├── user/              accounts, settings, per-user API keys
│   │       ├── favorite/          watchlist
│   │       ├── history/           watch progress, continue-watching
│   │       ├── title/             IMDb metadata (GraphQL)
│   │       ├── stream/            stream resolution + HLS proxy
│   │       ├── subtitle/          OpenSubtitles (optional)
│   │       └── learning/          vocabulary, AI helpers, tests, SRS
│   ├── .env.example
│   └── Makefile
├── web/                           React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                Radix-based primitives
│   │   │   └── system/            feature components (layout, title, player, learn, common)
│   │   ├── services/              fetch wrappers (auth, title, stream, subtitle, user, learn)
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
| POST | `/api/auth/signup`, `/api/auth/login` | Account creation and JWT login |
| GET | `/api/title/:imdb`, `/api/title/:imdb/similar` | IMDb title metadata via GraphQL |
| GET | `/api/title/search`, `/trending`, `/browse` | Discovery lists (cached 1h) |
| GET | `/api/stream` | Resolve stream URLs from the CDN |
| GET | `/hls` | HLS segment/manifest proxy with URL rewriting (mounted at root) |
| GET | `/api/subtitle/search`, `/api/subtitle/download` | OpenSubtitles search / WebVTT download (optional) |
| GET | `/api/learn/define`, `/api/learn/translate` | Public dictionary + translation helpers |
| * | `/api/me/*` | Auth-required: profile, settings, API keys, favorites, history, words, tests, SRS reviews |

## Getting Started

### Prerequisites

- **Go 1.25+** — the SQLite driver is pure Go (`modernc.org/sqlite`), so no C toolchain or CGO is needed
- **Node 20+** and **pnpm** (`corepack enable pnpm` or `npm i -g pnpm`)

The two apps are independent — there is no root `package.json`. Run them in separate terminals.

### 1. Backend

```bash
cd backend
cp .env.example .env       # then set JWT_SECRET — the server refuses to start without it
make dev                   # http://localhost:8081
```

The SQLite file (`./nicefilm.db` by default) is created and migrated automatically on first run.

`.env` values — only `JWT_SECRET` is required:

```env
# Server
PORT=8081
HOST=0.0.0.0

# Auth / DB
JWT_SECRET=your_secret     # required
TOKEN_TTL_HOURS=168        # JWT lifetime, default 7 days
DB_PATH=./nicefilm.db

# Optional — subtitles (https://www.opensubtitles.com/en/consumers)
# Leave blank to disable; /api/subtitle/* then returns 503.
OPENSUBTITLES_API_KEY=
OPENSUBTITLES_USERNAME=
OPENSUBTITLES_PASSWORD=
```

Other backend commands: `make build` / `make run` (binary at `bin/server`), `make tidy`, `go test ./...`.

**API keys for the optional integrations.** AI learning features (definitions, translations, word images, graded meaning tests) run on Gemini and are **per-user only** — there is no server-side key. Sign in and paste your own key at `/profile`; without it the AI features stay disabled. OpenSubtitles can also be set per-user there, and a user key takes precedence over the `.env` one.

### 2. Frontend

```bash
cd web
pnpm install
pnpm dev                   # http://localhost:5173
```

Vite proxies `/api` and `/hls` to `http://localhost:8081`, so the browser never calls the backend directly. Point it elsewhere with `API_URL=http://host:port pnpm dev`.

Other frontend commands: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm preview`.
