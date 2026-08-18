# The backend builds cgo-free (modernc.org/sqlite is pure Go), so the binary is
# static and the runtime image needs nothing but certificates.
FROM golang:1.25-alpine AS build

WORKDIR /src

# Dependencies first: they only change when go.mod/go.sum do, so edits to the
# source reuse this layer.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/api

FROM alpine:3.22

# ca-certificates for the upstreams the server talks to over TLS (IMDb GraphQL,
# the stream host, SubDL, Gemini); tzdata so timestamps aren't UTC-blind.
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 10001 app \
 && mkdir -p /data \
 && chown app:app /data

COPY --from=build /out/server /usr/local/bin/server

# /data is a volume: the SQLite file holds the single local account and every
# API key entered at Profile → Connections, so losing it means starting over.
# It is chowned above so the named volume inherits app's ownership on first run.
VOLUME ["/data"]

ENV HOST=0.0.0.0 \
    PORT=8081 \
    DB_PATH=/data/9film.db \
    GIN_MODE=release

USER app
EXPOSE 8081

# No dedicated health route — /api/me is the cheapest real one: it resolves the
# local account, so a 200 means the database opened and the seed is there.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8081/api/me >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
