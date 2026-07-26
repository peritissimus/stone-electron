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
    };
  } | null;

  if (!response.ok) {
    throw new HTTPError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.error?.code,
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
