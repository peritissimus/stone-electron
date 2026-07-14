import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { ShortcutsConfig } from '../../../domain/value-objects/AppConfig';

export class GetShortcutsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<ShortcutsConfig> {
    const config = await this.appConfigRepository.get();
    return config.shortcuts;
  }
}
