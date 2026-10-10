import { Cause, Effect, Exit } from 'effect';
import { MeetingUseCasesPort, type IMeetingUseCases } from '../../domain';

interface MeetingRuntime<RuntimeError> {
  runPromiseExit<A, E>(
    effect: Effect.Effect<A, E, IMeetingUseCases>,
    options?: { signal?: AbortSignal },
  ): Promise<Exit.Exit<A, E | RuntimeError>>;
}

/** A job's cancellation must interrupt the whole pipeline, including persistence. */
export function createMeetingEffectRunner<RuntimeError>(runtime: MeetingRuntime<RuntimeError>) {
  return async <A, E>(
    use: (service: IMeetingUseCases) => Effect.Effect<A, E>,
    options?: { signal?: AbortSignal },
  ): Promise<A> => {
    const exit = await runtime.runPromiseExit(
      MeetingUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
      options,
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
}
