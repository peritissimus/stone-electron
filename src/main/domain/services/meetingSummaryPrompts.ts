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
  'Summarize the meeting transcript below as a flat markdown bullet list.',
  '',
  'Rules:',
  '- Every line starts with `- ` — no headings, no prose, no blank lines between bullets.',
  '- One idea per bullet. Keep them short and concrete.',
  '- For anything actionable, use a task checkbox: `- [ ] action — owner if mentioned`.',
  '- Skip pleasantries, transitions, and filler.',
  '',
  'Transcript:',
  '{{transcript}}',
].join('\n');
