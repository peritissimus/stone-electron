/**
 * Default prompt templates used by the meeting summarization strategies.
 *
 * Lives in the domain layer so that use cases can reference defaults
 * without depending on adapter modules. Settings UI later overrides via
 * AppConfig and threads the override through the use case.
 *
 * The `{{transcript}}` placeholder is the contract between strategy and
 * caller — strategies replace it with the per-chunk transcript (or the
 * whole thing for single-shot).
 */

export const DEFAULT_MEETING_SUMMARY_PROMPT = [
  'You are summarizing a meeting transcript for a personal knowledge base.',
  'Produce a markdown response with exactly these sections:',
  '',
  '## Summary',
  'Two or three sentences capturing the meeting in plain language.',
  '',
  '## Key points',
  'Bulleted list of the most important decisions, observations, or context.',
  '',
  '## Action items',
  'Each as a markdown checkbox: `- [ ] action — owner if mentioned`. Omit the section if there are none.',
  '',
  'Transcript:',
  '{{transcript}}',
].join('\n');
