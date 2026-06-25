import type {
  AIProviderId,
  AIProviderKeyStatus,
  IAIProviderKeyStore,
} from '../../../domain/ports/out/IAIProviderKeyStore';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import { publishAIChanged } from './aiHelpers';

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
