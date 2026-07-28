import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorStatus } from './httpError';

/**
 * Runs work that can outlast a proxy's patience, without the proxy giving up.
 *
 * Cloudflare answers 524 when an origin produces no response within ~100s, and
 * generation-backed routes here routinely exceed a minute. The limit applies to
 * time-to-first-byte, not total duration: once bytes are flowing the connection
 * is held open. So the response begins immediately and emits whitespace until
 * the real payload is ready.
 *
 * Whitespace is legal between JSON tokens, so `response.json()` parses the
 * result unchanged and no caller has to know this happened.
 */

/** Comfortably inside the ~100s ceiling, and cheap enough to be unnoticeable. */
const HEARTBEAT_MS = 15_000;

export async function sendStreamedJson<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  context: string,
  work: () => Promise<T>,
): Promise<void> {
  // Fastify must not also try to serialise and end this response.
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    // Proxies that buffer would defeat the point by holding the heartbeat back.
    'X-Accel-Buffering': 'no',
  });

  // writeHead only buffers — Node holds the headers back until something is
  // written. Without this byte the response would not actually leave until the
  // first heartbeat, making time-to-first-byte depend on the interval below
  // rather than being immediate.
  reply.raw.write(' ');

  const heartbeat = setInterval(() => {
    if (!reply.raw.writableEnded) reply.raw.write(' ');
  }, HEARTBEAT_MS);

  try {
    const result = await work();
    reply.raw.end(JSON.stringify(result));
  } catch (error) {
    const statusCode = errorStatus(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, `${context} request failed`);
    } else {
      request.log.warn({ err: error }, `${context} request rejected`);
    }
    // The status line went out with the first byte and cannot be revised, so
    // the failure has to travel in the body. `error.status` carries what the
    // status code would have been; apiFetch treats this envelope as a failure.
    reply.raw.end(
      JSON.stringify({
        error: {
          code: errorCode(statusCode),
          status: statusCode,
          message:
            statusCode >= 500
              ? 'An unexpected server error occurred'
              : error instanceof Error
                ? error.message
                : 'Request failed',
        },
      }),
    );
  } finally {
    clearInterval(heartbeat);
  }
}

function errorCode(statusCode: number): string {
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 400) return 'VALIDATION_ERROR';
  if (statusCode === 422) return 'CONFIGURATION_ERROR';
  return 'INTERNAL_ERROR';
}
