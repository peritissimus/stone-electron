import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { MeetingsConfig } from '../../../domain/value-objects/AppConfig';

export class GetMeetingsSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<MeetingsConfig> {
    const config = await this.appConfigRepository.get();
    return config.meetings;
  }
}
