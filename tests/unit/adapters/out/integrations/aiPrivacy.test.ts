import { describe, expect, it } from 'vitest';
import {
  assertCloudInferenceAllowed,
  assertCloudNoteContentAllowed,
  providerModelId,
} from '../../../../../src/main/adapters/out/integrations/aiPrivacy';
import {
  DEFAULT_AI_CONFIG,
  type AIConfig,
} from '../../../../../src/main/domain/value-objects/AppConfig';

function config(overrides: Partial<AIConfig['privacy']> = {}): AIConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    privacy: {
      ...DEFAULT_AI_CONFIG.privacy,
      allowCloudInference: true,
      allowSendingNoteContent: true,
      allowSendingMetadata: true,
      ...overrides,
    },
  };
}

describe('aiPrivacy', () => {
  it('enforces cloud inference and note-content privacy gates', () => {
    expect(() => assertCloudInferenceAllowed(config())).not.toThrow();
    expect(() => assertCloudNoteContentAllowed(config())).not.toThrow();
    expect(() => assertCloudInferenceAllowed(config({ allowCloudInference: false }))).toThrow(
      'Cloud AI inference is disabled',
    );
    expect(() => assertCloudNoteContentAllowed(config({ allowSendingNoteContent: false }))).toThrow(
      'Sending note content to cloud AI providers is disabled',
    );
  });

  it('splits provider/model ids with a fallback for bare model names', () => {
    expect(providerModelId('anthropic/claude-sonnet-4', 'openai')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4',
    });
    expect(providerModelId('gpt-4.1-mini', 'openai')).toEqual({
      provider: 'openai',
      modelId: 'gpt-4.1-mini',
    });
  });
});
