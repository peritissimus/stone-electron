import type {
  AIProviderId,
  AIProviderKeyStatus,
  IAIProviderKeyStore,
} from '../../../domain/ports/out/IAIProviderKeyStore';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import { publishAIChanged } from './aiHelpers';

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
