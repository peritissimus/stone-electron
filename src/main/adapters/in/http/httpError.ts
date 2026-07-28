import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Effect wraps failures, so the useful name arrives as
 * "(FiberFailure) AI_LoadAPIKeyError". Compare against the tail.
 */
const errorName = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  return name.replace(/^\(FiberFailure\)\s*/, '');
};

/**
 * Failures the caller can actually fix — a missing provider key, a model that
 * does not exist, a privacy setting that forbids the call. These are reported
 * with their real message, because telling someone "an unexpected server error
 * occurred" when the answer is "add an API key" sends them to the wrong place.
 */
function isConfigurationError(error: unknown): boolean {
  const name = errorName(error);
  const message = error instanceof Error ? error.message : '';
  // Every Vercel AI SDK error class is prefixed AI_.
  if (name.startsWith('AI_')) return true;
  return /\bapi key\b/i.test(message) || /\bis disabled\b/i.test(message);
}

/** Maps a thrown use-case error onto an HTTP status. */
export function errorStatus(error: unknown): number {
  const name = errorName(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (name.includes('NotFound') || message.includes('not found')) return 404;
  if (name.includes('Validation') || name.includes('ZodError')) return 400;
  if (isConfigurationError(error)) return 422;
  return 500;
}

/**
 * Sends the error envelope the web bridge expects. 5xx bodies stay generic so
 * internal failures never leak out; the detail goes to the server log instead.
 */
export function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  context: string,
  codes: { notFound?: string } = {},
) {
  const statusCode = errorStatus(error);
  if (statusCode >= 500) {
    request.log.error({ err: error }, `${context} request failed`);
  } else if (statusCode === 422) {
    // Not a fault, but worth a breadcrumb for anyone reading the log.
    request.log.warn({ err: error }, `${context} request needs configuration`);
  }

  const code =
    statusCode === 404
      ? (codes.notFound ?? 'NOT_FOUND')
      : statusCode === 400
        ? 'VALIDATION_ERROR'
        : statusCode === 422
          ? 'CONFIGURATION_ERROR'
          : 'INTERNAL_ERROR';

  return reply.status(statusCode).send({
    error: {
      code,
      message:
        statusCode >= 500
          ? 'An unexpected server error occurred'
          : error instanceof Error
            ? error.message
            : 'Request failed',
    },
  });
}
