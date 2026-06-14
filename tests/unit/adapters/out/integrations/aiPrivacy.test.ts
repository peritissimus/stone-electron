import { describe, expect, it } from 'vitest';
import {
  assertCloudInferenceAllowed,
  assertCloudNoteContentAllowed,
} from '../../../../../src/main/domain/services/aiPrivacyPolicy';
import { providerModelId } from '../../../../../src/main/adapters/out/integrations/AISDKTextGenerator';
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
    expect(providerModelId('groq/llama-3.3-70b-versatile', 'openai')).toEqual({
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
    });
    expect(providerModelId('gpt-4.1-mini', 'openai')).toEqual({
      provider: 'openai',
      modelId: 'gpt-4.1-mini',
    });
  });
});
