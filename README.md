# NiceFilm

A streaming front-end with a Go backend for fetching real video streams from IMDb title IDs.

## Project Structure

```
nicefilm/
├── backend/      Go Gin backend (stream proxy, IMDb, subtitles)
├── web/          React + TypeScript + Vite frontend
├── docs/         Project documentation & requirements
└── README.md
```

## Getting Started

### API (Go backend)

```bash
cd backend
cp .env.example .env   # fill in OPENSUBTITLES_* for subtitle support
make dev               # runs on http://localhost:8080
```

**Endpoints:**

| Route | Description |
|---|---|
| `GET /api/titles/:imdbId` | Fetch IMDb title details |
| `GET /api/stream` | Proxy to stream CDN |
| `GET /api/subtitles/search` | OpenSubtitles search |
| `GET /api/subtitles/vtt` | Download subtitle as WebVTT |
| `GET /proxy/hls` | HLS segment/manifest proxy |

### Web (React frontend)

```bash
cd web
npm install
npm run dev            # runs on http://localhost:5173
```

Vite proxies `/api` and `/proxy` to the Go backend at `http://localhost:8080`.

### Test

Navigate to `http://localhost:5173/watch/tt0903747` to watch Breaking Bad.
