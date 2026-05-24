import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type {
  AIProviderId,
  AIProviderKeyStatus,
  IAIProviderKeyStore,
} from '../../../domain/ports/out/IAIProviderKeyStore';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AIConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';

function publishAIChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'ai' },
  });
}

function mergeAIPatch(current: AIConfig, patch: Partial<AIConfig>): AIConfig {
  const allowCloudInference =
    patch.privacy?.allowCloudInference ?? current.privacy.allowCloudInference;

  return {
    indexing: { ...current.indexing, ...(patch.indexing ?? {}) },
    models: { ...current.models, ...(patch.models ?? {}) },
    privacy: {
      ...current.privacy,
      ...(patch.privacy ?? {}),
      allowCloudInference,
      allowSendingNoteContent: allowCloudInference
        ? (patch.privacy?.allowSendingNoteContent ?? current.privacy.allowSendingNoteContent)
        : false,
      allowSendingMetadata: allowCloudInference
        ? (patch.privacy?.allowSendingMetadata ?? current.privacy.allowSendingMetadata)
        : false,
    },
  };
}

export class GetAISettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<AIConfig> {
    const config = await this.appConfigRepository.get();
    return config.ai;
  }
}

export class UpdateAISettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { ai: Partial<AIConfig> }): Promise<AIConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      ai: mergeAIPatch(config.ai, request.ai),
    }));
    publishAIChanged(this.eventPublisher);
    return next.ai;
  }
}

export class ResetAISettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<AIConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      ai: DEFAULT_APP_CONFIG.ai,
    }));
    publishAIChanged(this.eventPublisher);
    return next.ai;
  }
}

export class GetAIProviderKeysUseCase {
  constructor(private readonly aiProviderKeyStore: IAIProviderKeyStore) {}

  async execute(): Promise<AIProviderKeyStatus[]> {
    return this.aiProviderKeyStore.listStatuses();
  }
}

export class SetAIProviderKeyUseCase {
  constructor(
    private readonly aiProviderKeyStore: IAIProviderKeyStore,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { provider: AIProviderId; apiKey: string }): Promise<AIProviderKeyStatus[]> {
    const apiKey = request.apiKey.trim();
    if (!apiKey) {
      throw new Error('API key cannot be empty');
    }

    await this.aiProviderKeyStore.setKey(request.provider, apiKey);
    publishAIChanged(this.eventPublisher);
    return this.aiProviderKeyStore.listStatuses();
  }
}

export class DeleteAIProviderKeyUseCase {
  constructor(
    private readonly aiProviderKeyStore: IAIProviderKeyStore,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { provider: AIProviderId }): Promise<AIProviderKeyStatus[]> {
    await this.aiProviderKeyStore.deleteKey(request.provider);
    publishAIChanged(this.eventPublisher);
    return this.aiProviderKeyStore.listStatuses();
  }
}
