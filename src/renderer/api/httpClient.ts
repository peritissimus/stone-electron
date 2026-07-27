const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '');

export class HTTPError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: {
      code?: string;
      message?: string;
      status?: number;
    };
  } | null;

  if (!response.ok) {
    throw new HTTPError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.error?.code,
    );
  }

  // Long-running routes stream their response so a proxy sees bytes immediately,
  // which commits the status line before the outcome is known. A failure can
  // then only arrive in the body, carrying the status it would have had.
  //
  // Matched on `status` specifically: payloads legitimately carry an `error`
  // field of their own — a failed meeting recording has one — and those are
  // strings, never an envelope naming its own HTTP status.
  const streamedFailure = payload?.error;
  if (streamedFailure && typeof streamedFailure.status === 'number') {
    throw new HTTPError(
      streamedFailure.message ?? 'Request failed',
      streamedFailure.status,
      streamedFailure.code,
    );
  }

  return payload as T;
}

/**
 * Fetches a binary body (audio tracks). Returns null on 404 so callers can
 * treat a missing track as absent rather than as an error.
 */
export async function apiFetchBytes(
  path: string,
  options: RequestInit = {},
): Promise<Uint8Array | null> {
  const response = await fetch(`${apiBaseUrl}${path}`, options);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HTTPError(`Request failed with status ${response.status}`, response.status);
  }

  return new Uint8Array(await response.arrayBuffer());
}
