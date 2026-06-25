import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { MeetingsConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishMeetingsChanged } from './meetingsHelpers';

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
