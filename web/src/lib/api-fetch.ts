// Thin authenticated fetch wrapper for the /api/me and /api/auth endpoints.
// The auth context registers a token getter + a 401 handler at runtime so this
// module stays decoupled from React.

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function registerAuth(tokenGetter: () => string | null, unauthorized: () => void) {
  getToken = tokenGetter;
  onUnauthorized = unauthorized;
}

export class ApiError extends Error {
  status: number;
  /** Optional machine-readable code from the JSON body (e.g. 'shared_rate_limited'). */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean; // attach bearer token (default true)
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401) {
    onUnauthorized();
  }

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const { error, code } = json as { error?: string; code?: string };
    throw new ApiError(res.status, error ?? `Request failed (${res.status})`, code);
  }
  return json as T;
}

// Authenticated GET returning binary data — used for endpoints an <img> can't
// reach directly because it can't send the bearer token (e.g. the per-user word
// illustration). The caller wraps the Blob in an object URL.
export async function apiFetchBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { headers, signal });
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    // Parse the JSON error body (if any) so callers can branch on `code` — e.g.
    // the subtitle download surfaces 'shared_rate_limited'.
    const { error, code } = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(res.status, error ?? `Request failed (${res.status})`, code);
  }
  return res.blob();
}
