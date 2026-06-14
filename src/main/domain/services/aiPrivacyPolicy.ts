/**
 * AI privacy policy — business rules that gate cloud inference and note-content
 * egress. Pure domain logic over AIConfig; no external dependencies. Adapters
 * (e.g. the text generator) call these before sending anything to a provider.
 */

import type { AIConfig } from '../value-objects/AppConfig';

/** Cloud inference must be explicitly enabled by the user. */
export function assertCloudInferenceAllowed(config: AIConfig): void {
  if (!config.privacy.allowCloudInference) {
    throw new Error('Cloud AI inference is disabled in AI privacy settings');
  }
}

/** Cloud inference AND sending note content must both be opted into. */
export function assertCloudNoteContentAllowed(config: AIConfig): void {
  assertCloudInferenceAllowed(config);
  if (!config.privacy.allowSendingNoteContent) {
    throw new Error('Sending note content to cloud AI providers is disabled');
  }
}
