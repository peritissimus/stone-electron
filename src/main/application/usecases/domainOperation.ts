import { Effect } from 'effect';
import * as DomainErrors from '../../domain/errors';
import type { DomainError } from '../../domain/errors';

/** Bridge legacy throwing entity transitions into Effect's expected error channel. */
export function domainOperation<A>(operation: () => A): Effect.Effect<A, DomainError> {
  return Effect.try({ try: operation, catch: (error) => error }).pipe(
    Effect.catchAll((error) => (isDomainError(error) ? Effect.fail(error) : Effect.die(error))),
  );
}

function isDomainError(error: unknown): error is DomainError {
  return Object.values(DomainErrors).some((ErrorType) => error instanceof ErrorType);
}
