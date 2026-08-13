// Thin fetch wrapper for the /api/me endpoints. The app has no sign-in: the
// backend resolves the single local account itself, so there is no token to
// attach and no 401 to recover from.

export class ApiError extends Error {
  status: number;
  /** Optional machine-readable code from the JSON body (e.g. 'provider_key_missing'). */
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
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const { error, code } = json as { error?: string; code?: string };
    throw new ApiError(res.status, error ?? `Request failed (${res.status})`, code);
  }
  return json as T;
}

// GET returning binary data — used where a plain element can't consume the
// response directly (e.g. a subtitle download the caller wraps in an object URL).
export async function apiFetchBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(path, { signal });
  if (!res.ok) {
    // Parse the JSON error body (if any) so callers can branch on `code` — e.g.
    // the subtitle download surfaces 'provider_key_missing'.
    const { error, code } = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(res.status, error ?? `Request failed (${res.status})`, code);
  }
  return res.blob();
}
