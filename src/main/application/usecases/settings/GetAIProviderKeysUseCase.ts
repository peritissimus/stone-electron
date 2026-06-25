import type {
  AIProviderKeyStatus,
  IAIProviderKeyStore,
} from '../../../domain/ports/out/IAIProviderKeyStore';

export class GetAIProviderKeysUseCase {
  constructor(private readonly aiProviderKeyStore: IAIProviderKeyStore) {}

  async execute(): Promise<AIProviderKeyStatus[]> {
    return this.aiProviderKeyStore.listStatuses();
  }
}
