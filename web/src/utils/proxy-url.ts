/** Route HLS requests through the API server (proxied by Vite in dev) to avoid CDN CORS blocks. */
export function proxyStreamUrl(url: string): string {
  if (import.meta.env.DEV) {
    return `/proxy/hls?url=${encodeURIComponent(url)}`;
  }
  return url;
}
