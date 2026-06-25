import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AIConfig } from '../../../domain/value-objects/AppConfig';

export function publishAIChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'ai' },
  });
}

export function mergeAIPatch(current: AIConfig, patch: Partial<AIConfig>): AIConfig {
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
