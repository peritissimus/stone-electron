/**
 * TopicOrganizer — the timer behind automatic topic organization.
 *
 * Topics are not a user-managed surface: nobody creates, adopts, or curates
 * them. This layer forks a fiber that runs the organize pass on an interval
 * for as long as the application runtime is alive, so clustering discovers new
 * topics and newly written notes get filed without anyone asking.
 *
 * The first pass is delayed: startup sync indexes the workspace, and there is
 * no point clustering vectors that are still being written. Failures are
 * logged and swallowed — the next tick retries with a fresh view of the data.
 */

import { Effect, Layer, Schedule } from 'effect';
import { TopicUseCasesPort } from '../../domain';
import { logger } from '../../shared/utils';

export interface TopicOrganizerConfig {
  /** Quiet period after the runtime starts before the first pass. */
  startupDelayMs?: number;
  /** Spacing between passes. */
  intervalMs?: number;
}

const DEFAULTS = {
  startupDelayMs: 2 * 60_000,
  intervalMs: 30 * 60_000,
} as const;

export const TopicOrganizerLive = (config: TopicOrganizerConfig = {}) => {
  const startupDelayMs = config.startupDelayMs ?? DEFAULTS.startupDelayMs;
  const intervalMs = config.intervalMs ?? DEFAULTS.intervalMs;

  return Layer.scopedDiscard(
    Effect.gen(function* () {
      const topics = yield* TopicUseCasesPort;
      const pass = topics.organizeTopics.execute().pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            if (!result.ran) return;
            if (
              result.topicsCreated === 0 &&
              result.notesClassified === 0
            ) {
              return;
            }
            logger.info(
              `[Topics] Organized workspace: ${result.topicsCreated} topic(s) created, ` +
                `${result.notesAssigned} note(s) assigned, ${result.notesClassified} classified`,
            );
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => logger.warn('[Topics] Organize pass failed:', error)),
        ),
      );

      yield* Effect.forkScoped(
        Effect.sleep(startupDelayMs).pipe(
          Effect.zipRight(pass.pipe(Effect.repeat(Schedule.spaced(intervalMs)))),
        ),
      );
    }),
  );
};
