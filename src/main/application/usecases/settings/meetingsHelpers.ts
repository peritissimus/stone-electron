import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { MeetingsConfig } from '../../../domain/value-objects/AppConfig';

export function publishMeetingsChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'meetings' },
  });
}

/**
 * Validate the retention window. Accepts -1 (delete after transcribing),
 * 0 (keep until the meeting is deleted), or any positive integer day count.
 * Anything else falls back to the current value so a bad client payload
 * can't corrupt the setting.
 */
export function sanitizeRetentionDays(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < -1) return fallback;
  return value;
}

export function mergeMeetingsPatch(
  current: MeetingsConfig,
  patch: Partial<MeetingsConfig>,
): MeetingsConfig {
  return {
    audioRetentionDays:
      patch.audioRetentionDays === undefined
        ? current.audioRetentionDays
        : sanitizeRetentionDays(patch.audioRetentionDays, current.audioRetentionDays),
  };
}
