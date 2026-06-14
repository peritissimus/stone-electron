import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { MeetingsConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';

function publishMeetingsChanged(eventPublisher?: IEventPublisher): void {
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
function sanitizeRetentionDays(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < -1) return fallback;
  return value;
}

function mergeMeetingsPatch(
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

export class GetMeetingsSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<MeetingsConfig> {
    const config = await this.appConfigRepository.get();
    return config.meetings;
  }
}

export class UpdateMeetingsSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { meetings: Partial<MeetingsConfig> }): Promise<MeetingsConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      meetings: mergeMeetingsPatch(config.meetings, request.meetings),
    }));
    publishMeetingsChanged(this.eventPublisher);
    return next.meetings;
  }
}

export class ResetMeetingsSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<MeetingsConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      meetings: DEFAULT_APP_CONFIG.meetings,
    }));
    publishMeetingsChanged(this.eventPublisher);
    return next.meetings;
  }
}
