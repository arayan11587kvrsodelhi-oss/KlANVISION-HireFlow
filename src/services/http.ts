/**
 * Central HTTP client for the HireFlow API.
 *
 * Authentication model
 * --------------------
 * - The access token lives **in memory** (module variable) for the lifetime of
 *   the tab. It is never written to localStorage/sessionStorage, so an XSS
 *   payload cannot read a persisted credential, and a shared machine does not
 *   retain a session after the tab closes.
 * - The refresh token is an HttpOnly cookie managed entirely by the browser;
 *   JavaScript never sees it. `POST /auth/refresh` rotates it.
 * - On a 401 the client makes exactly one attempt to refresh and replay the
 *   request. Concurrent 401s share a single refresh promise so a page with
 *   three parallel requests does not rotate the token three times (which the
 *   server would interpret as replay).
 * - Cross-origin cookies require `credentials: 'include'`.
 */

import type { AuthToken } from '../types';

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

/**
 * Base URL of the API, including the ``/api/v1`` prefix.
 *
 * Set ``VITE_API_BASE_URL``:
 * - ``/api/v1`` (recommended for local development): same-origin through the
 *   Vite proxy, so the refresh cookie is first-party and behaves exactly as it
 *   will in production.
 * - ``https://api.example.com/api/v1``: split-origin deployment. Requires that
 *   origin in the backend's CORS list and a SameSite=None; Secure cookie.
 * - unset: same-origin ``/api/v1``.
 */
export const API_BASE_URL: string = configuredBase || '/api/v1';

/** A structured error surfaced to the UI. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors: { field: string; message: string }[];

  constructor(
    status: number,
    message: string,
    code = 'error',
    fieldErrors: { field: string; message: string }[] = []
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** 401/403: the caller must sign in again or lacks permission. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** First field-level message, useful for inline form errors. */
  get firstFieldError(): string | undefined {
    return this.fieldErrors[0]?.message;
  }
}

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Register the callback used when the session cannot be recovered.
 * The auth provider uses this to clear user state and redirect to /login.
 */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = response.statusText || 'Request failed';
  let code = 'error';
  let fieldErrors: { field: string; message: string }[] = [];
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') detail = body.detail;
    if (typeof body?.code === 'string') code = body.code;
    if (Array.isArray(body?.errors)) fieldErrors = body.errors;
    else if (Array.isArray(body?.detail)) {
      // FastAPI's default validation shape (defensive; our handler reshapes it).
      fieldErrors = body.detail.map((d: { loc?: string[]; msg?: string }) => ({
        field: (d.loc ?? []).slice(1).join('.'),
        message: d.msg ?? 'Invalid value',
      }));
      detail = fieldErrors[0]?.message ?? detail;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(response.status, detail, code, fieldErrors);
}

/**
 * Try to obtain a new access token using the refresh cookie.
 * Returns null when the session is gone.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as AuthToken;
      accessToken = data.access_token;
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  /** Set for multipart uploads: the body is sent as FormData untouched. */
  formData?: FormData;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
  signal?: AbortSignal;
}

async function execute<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, query, formData, _retried = false, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the HireFlow API. Check your connection.', 'network_error');
  }

  if (response.status === 401 && !_retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return execute<T>(path, { ...options, _retried: true });
    }
    onUnauthenticated?.();
    throw await parseError(response);
  }

    if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as T;
}
export const http = {
  get: <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal) =>
    execute<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => execute<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => execute<T>(path, { method: 'POST', formData }),
};

/** Build an absolute URL to an API path (used for authenticated downloads). */
export function apiUrl(path: string): string {
  // If path already includes the API prefix, don't duplicate it.
  // This handles both relative paths from the frontend and absolute paths from the backend.
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath.startsWith(base)) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Download a protected file with the bearer token.
 *
 * A plain <a href> cannot send the Authorization header, so the bytes are
 * fetched and handed to the browser as a blob URL. The URL is revoked
 * immediately after the click.
 */
export async function downloadAuthenticated(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const fileName = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
