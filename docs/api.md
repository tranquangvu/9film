# API

Everything is under `/api`, except `/hls`, which is mounted at the root. No authentication: every request runs as the one local account, so `/me` is that account.

## Titles

| | |
|---|---|
| `GET /api/title/:imdb` | Full metadata |
| `GET /api/title/:imdb/similar` | More like this one |
| `GET /api/title/search` | Search |
| `GET /api/title/trending` | Trending |
| `GET /api/title/browse` | Browse by type, sort, recency |

IMDb responses are cached for an hour before per-user state (favorite, progress) is folded in.

## Playback

| | |
|---|---|
| `GET /api/stream` | Resolve stream URLs; for a series, the season → episode map |
| `GET /hls?url=…` | Manifest and segment proxy — see [Architecture](architecture.md) |

## Subtitles

| | |
|---|---|
| `GET /api/subtitle/search` | What the provider has for this title |
| `GET /api/subtitle/download?id=…` | One track, converted to WebVTT |

Ids are opaque (`subdl:/subtitle/x.zip|S01E02`) and only the owning provider parses them. Without a SubDL key both return `503` with `code: "provider_key_missing"`; a throttled provider returns `429` with `code: "provider_rate_limited"`.

## Learning

| | |
|---|---|
| `GET /api/learn/define` | Dictionary lookup |
| `GET /api/learn/translate` | Translation |
| `GET /api/me/words` · `POST` · `DELETE` | Saved vocabulary |
| `POST /api/me/words/import` | Bulk import |
| `GET /api/me/words/stats` | Per-word history |
| `PUT /api/me/words/complete` | Mark a word learned |
| `GET /api/me/words/explain` | Phrase/idiom breakdown (Gemini; falls back to a translation) |
| `GET /api/me/tests` · `POST` | Self-tests |
| `GET /api/me/reviews` · `POST` | SM-2 spaced repetition |

`/api/learn/*` uses public dictionary and translation APIs and needs no key. Only `explain` and the grading inside `POST /api/me/tests` use Gemini.

## The account

| | |
|---|---|
| `GET /api/me` · `PUT` | Profile (avatar only — the username is fixed) |
| `GET /api/me/settings` · `PUT` | Settings |
| `GET /api/me/credentials` · `PUT` | The SubDL and Gemini keys |
| `GET /api/me/favorites` · `POST` · `DELETE` | Watchlist, paginated |
| `GET /api/me/history` · `PUT` | Watch progress and continue-watching |
| `PUT /api/me/subtitles` | Remember a subtitle choice for a title |

`GET /api/me/credentials` reports whether each key is set — it never returns the key itself. On `PUT`, a blank field leaves the stored key alone rather than clearing it.
