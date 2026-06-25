import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { MeetingsConfig } from '../../../domain/value-objects/AppConfig';
import { mergeMeetingsPatch, publishMeetingsChanged } from './meetingsHelpers';

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
