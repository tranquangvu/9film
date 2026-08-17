# 9Film

A personal streaming app that plays any IMDb title (HLS proxying, SubDL subtitles, TV episode selection) and layers an English-learning toolkit on top: vocabulary, AI definitions and translations, spelling/meaning self-tests, and SM-2 spaced repetition.

**Frontend** — React 19, TypeScript, Vite, Tailwind, Framer Motion, Video.js, TanStack Query
**Backend** — Go, Gin, Zap, SQLite (pure-Go driver, no CGO)

## Download

**[⬇︎ 9film.dmg — macOS, universal](https://github.com/tranquangvu/9film/releases/latest/download/9film.dmg)** · [all releases](https://github.com/tranquangvu/9film/releases)

One app, nothing to run alongside it: the server lives inside the window. macOS 10.15+, Apple Silicon and Intel both.

1. Open the `.dmg` and drag **9film** into Applications.
2. First launch, macOS will refuse it — the app is ad-hoc signed, not notarized, because notarizing needs a paid Apple Developer account. Open **System Settings → Privacy & Security**, scroll to the message about 9film and click **Open Anyway**. (Older macOS: right-click the app → **Open** → **Open**.) One time only.
3. The welcome screen asks for two optional API keys — [both are skippable](#no-sign-in-and-the-two-optional-keys), and the app works without them.

Prefer the terminal to the Gatekeeper dance:

```bash
xattr -dr com.apple.quarantine /Applications/9film.app
```

No Windows or Linux build yet — the window chrome and the app's data directory are macOS-specific. Running from source works anywhere Go and Node do (see [Getting started](#getting-started)).

## Structure

```
backend/                 Go Gin API
├── cmd/api/main.go
├── server/              public seam for embedders (the desktop build)
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
desktop/                 macOS app (Wails v2) — both of the above in one window
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

## Desktop app (macOS)

`desktop/` packages the same two apps as one `9film.app`: the Gin engine runs in-process and the built frontend is embedded, so there is nothing to start and no browser tab. The window has no title bar of its own — the app's navbar is it, with the native traffic lights inset over it.

To build it yourself — [the release](#download) is this, built on a Mac and dragged into a `.dmg`. Prerequisites: the [Wails v2 CLI](https://wails.io) and Xcode command line tools.

```bash
cd desktop
make dev            # live-reloading window (Vite + Go)
make build          # build/bin/9film.app, universal, ad-hoc signed
make dmg            # build/bin/9film.dmg
```

The desktop app keeps its own library at `~/Library/Application Support/9film/9film.db` — separate from the `./9film.db` that `make dev` uses, so the two don't share favorites or progress. It is not notarized, so the first open needs the usual Gatekeeper override.

## No sign-in, and the two optional keys

The app is single-user by design: it runs on your machine against a local SQLite file, so the backend resolves one account at startup and every request runs as it. No login, no password, no token.

Both API keys are asked for once in the welcome flow at `/welcome` (which also carries the licence notice) and can be changed at `/profile` → Connections. They live in the database — the server ships with none and has no `.env` fallback. Both are skippable, and each feature degrades on its own:

- **SubDL** — no key means no subtitles; playback and everything else are unaffected.
- **Gemini** — powers idiom/phrase breakdowns and AI-graded meaning answers in self-tests. Without it, phrases fall back to a plain translation and meaning answers to a local string heuristic. Dictionary lookups and translations never touch Gemini — they use separate public APIs.
