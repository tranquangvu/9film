# NiceFilm

A streaming app built with React on the frontend and Go on the backend. Streams real video from any IMDb title ID, with HLS proxying, subtitle support via OpenSubtitles, and episode selection for TV series.

## Stack

**Frontend** — React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Framer Motion, Video.js  
**Backend** — Go 1.23, Gin, Zap, godotenv

## Project Structure

```
nicefilm/
├── backend/                   Go Gin API
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/            env loading
│   │   ├── handler/           HTTP handlers
│   │   ├── logger/            zap setup
│   │   ├── router/            route registration + middleware
│   │   └── service/           IMDb, stream proxy, HLS proxy, subtitles
│   ├── .env.example
│   └── Makefile
├── web/                       React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            base primitives (Button, Tag, Select, …)
│   │   │   └── system/        feature components (layout, movie, player)
│   │   ├── hooks/             use-player-session
│   │   ├── pages/             route-level components
│   │   └── utils/             IMDb, stream, subtitle, HLS utilities
│   └── vite.config.ts         proxies /api and /proxy → backend:8080
├── docs/
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/title/:imdb` | Fetch IMDb title metadata via GraphQL |
| GET | `/api/subtitle/search` | Search subtitles via OpenSubtitles |
| GET | `/api/subtitle/download` | Download subtitle as WebVTT |
| GET | `/api/stream` | Proxy stream URLs from CDN |
| GET | `/proxy/hls` | HLS segment/manifest proxy with URL rewriting |

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
make dev          # http://localhost:8080
```

Subtitle support requires an [OpenSubtitles API key](https://www.opensubtitles.com/en/consumers). Fill in `.env`:

```env
OPENSUBTITLES_API_KEY=your_key
OPENSUBTITLES_USERNAME=your_username
OPENSUBTITLES_PASSWORD=your_password
```

### Frontend

```bash
cd web
pnpm install
pnpm dev          # http://localhost:5173
```

## Usage

Navigate to `/watch/:imdb` to stream any title. For example:

- `http://localhost:5173/watch/tt0903747` — Breaking Bad
- `http://localhost:5173/watch/tt0468569` — The Dark Knight
