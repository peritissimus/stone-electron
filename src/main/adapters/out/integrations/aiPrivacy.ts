import type { AIConfig } from '../../../domain/value-objects/AppConfig';

export function assertCloudInferenceAllowed(config: AIConfig): void {
  if (!config.privacy.allowCloudInference) {
    throw new Error('Cloud AI inference is disabled in AI privacy settings');
  }
}

export function assertCloudNoteContentAllowed(config: AIConfig): void {
  assertCloudInferenceAllowed(config);
  if (!config.privacy.allowSendingNoteContent) {
    throw new Error('Sending note content to cloud AI providers is disabled');
  }
}

export function providerModelId(model: string, fallbackProvider: string): {
  provider: string;
  modelId: string;
} {
  const slashIndex = model.indexOf('/');
  if (slashIndex <= 0) {
    return { provider: fallbackProvider, modelId: model };
  }

  return {
    provider: model.slice(0, slashIndex),
    modelId: model.slice(slashIndex + 1),
  };
}
