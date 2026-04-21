import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import {
  DEFAULT_APP_CONFIG,
  type AppearanceSettings,
  type AppAccentColor,
  type AppTheme,
  type FontSettings,
} from '@shared/types/settings';

function publishAppearanceChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'appearance' },
  });
}

async function getAppearanceSettings(repository: IAppConfigRepository): Promise<AppearanceSettings> {
  const config = await repository.get();
  return config.appearance;
}

export class GetAppearanceSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<AppearanceSettings> {
    return getAppearanceSettings(this.appConfigRepository);
  }
}

export class SetThemeUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { theme: AppTheme }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: { ...config.appearance, theme: request.theme },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}

export class SetAccentColorUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { accentColor: AppAccentColor }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: { ...config.appearance, accentColor: request.accentColor },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}

export class UpdateFontSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { fontSettings: Partial<FontSettings> }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: {
        ...config.appearance,
        fontSettings: { ...config.appearance.fontSettings, ...request.fontSettings },
      },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}

export class ResetFontSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: {
        ...config.appearance,
        fontSettings: DEFAULT_APP_CONFIG.appearance.fontSettings,
      },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}
