# Getting started

## Prerequisites

- **Go 1.25+** — backend
- **Node 20+ and pnpm** — frontend
- **Wails v2 CLI + Xcode command line tools** — only for the macOS app

## Run it

The backend and frontend are independent apps. Two terminals:

```bash
cd backend && make dev                 # :8081
cd web && pnpm install && pnpm dev     # :5173
```

Open http://localhost:5173. Vite proxies `/api` and `/hls` to the backend, so the browser only ever talks to one origin. To point it at a backend somewhere else:

```bash
API_URL=http://192.168.1.10:8081 pnpm dev
```

## First run

`./9film.db` is created, migrated and seeded with the single local account. There is no sign-up: every request runs as that account.

The app opens on `/welcome`, which asks for two optional API keys. Skip them and the app still plays films — you just get no subtitles (SubDL) and plain translations instead of idiom breakdowns (Gemini). Both can be set later at **Profile → Connections**.

## Commands

| Where | Command | |
|---|---|---|
| `backend/` | `make dev` | run on :8081 |
| | `make build` / `make run` | binary at `bin/server` |
| | `make tidy` | `go mod tidy` |
| | `go test ./...` | all tests |
| | `go test ./internal/modules/learning -run TestName` | one test |
| `web/` | `pnpm dev` | Vite on :5173 |
| | `pnpm build` | production bundle into `dist/` |
| | `pnpm typecheck` | `tsc -b` |
| | `pnpm lint` | eslint |
| `desktop/` | `make dev` | live-reloading app window |
| | `make build` / `make dmg` | `.app` / `.dmg` |

## Configuration

The backend reads three environment variables, optionally from `backend/.env`. None of them is a secret — the API keys live in the database.

| | | |
|---|---|---|
| `PORT` | `8081` | |
| `HOST` | `127.0.0.1` | loopback, because nothing authenticates the port. Set `0.0.0.0` only if you mean to expose it |
| `DB_PATH` | `./9film.db` | |
