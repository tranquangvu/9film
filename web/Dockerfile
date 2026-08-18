FROM node:24-alpine AS build

# pnpm pinned rather than via corepack: corepack is deprecated in current Node
# and a build shouldn't depend on which way that lands.
RUN npm install -g pnpm@10.14.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# VITE_DESKTOP stays unset: this is the browser build, so utils/desktop.ts keeps
# apiOrigin empty and every /api and /hls path is relative — which is what lets
# nginx below serve them from the same origin.
RUN pnpm build

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# Not *.conf on purpose: nginx auto-includes conf.d/*.conf into the http block,
# and these are proxy directives that only make sense inside a location.
COPY proxy.inc /etc/nginx/conf.d/proxy.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
