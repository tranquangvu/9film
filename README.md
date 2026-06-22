# NiceFilm

A streaming app built with React on the frontend and Go on the backend. It streams real video from any IMDb title ID (HLS proxying, OpenSubtitles subtitles, TV episode selection) and layers an English-learning toolkit on top — vocabulary, AI definitions/translations, spelling and meaning self-tests, and SM-2 spaced-repetition review.

## Stack

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Video.js, TanStack Query
**Backend** — Go, Gin, Zap, SQLite, JWT, godotenv

## Project Structure

```
nicefilm/
├── backend/                       Go Gin API
│   ├── cmd/server/main.go
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
| GET | `/api/title/:imdb` | Fetch IMDb title metadata via GraphQL |
| GET | `/api/stream` | Resolve stream URLs from the CDN |
| GET | `/hls` | HLS segment/manifest proxy with URL rewriting (mounted at root) |
| GET | `/api/subtitle/search`, `/api/subtitle/download` | OpenSubtitles search / WebVTT download (optional) |
| GET | `/api/learn/define`, `/api/learn/translate` | Public dictionary + translation helpers |
| * | `/api/me/*` | Auth-required: favorites, history, words, tests, SRS reviews |

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env       # set JWT_SECRET (required)
make dev                   # http://localhost:8081
```

`JWT_SECRET` is required. Two integrations are optional and degrade gracefully when their key is unset:

```env
JWT_SECRET=your_secret

# Optional — subtitles (https://www.opensubtitles.com/en/consumers)
OPENSUBTITLES_API_KEY=your_key
OPENSUBTITLES_USERNAME=your_username
OPENSUBTITLES_PASSWORD=your_password
```

AI learning features (definitions, translations, graded tests) are configured per-user: each signed-in user supplies their own Gemini key in their profile. OpenSubtitles can also be set per-user, taking precedence over the `.env` values.

### Frontend

```bash
cd web
pnpm install
pnpm dev                   # http://localhost:5173
```

Run both apps together — Vite proxies `/api` and `/hls` to the backend, so the browser never calls it directly.

## Usage

Navigate to `/watch/:id` to stream any title (the id is an IMDb id):

- `http://localhost:5173/watch/tt0903747` — Breaking Bad
- `http://localhost:5173/watch/tt0468569` — The Dark Knight

Create an account to build a watchlist, resume from where you left off, and use the learning tools at `/my-learning`.
