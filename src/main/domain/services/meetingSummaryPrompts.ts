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
  'You are turning a transcript of a recorded conversation into clear, useful notes.',
  'Lines are labelled "You:" (the person recording) and "Others:" (whoever they',
  'were talking to). The conversation might be a formal meeting, a quick sync, a',
  '1:1, or a casual personal call — read what it actually is and match that. Do',
  'NOT force a corporate "meeting" framing onto a casual chat.',
  '',
  'Write notes someone could skim in fifteen seconds and know what mattered.',
  '',
  'Format (markdown):',
  '- Open with one short italic line capturing the gist (e.g. `*Catch-up call about travel plans and a few logistics.*`).',
  '- Then, only the sections that actually apply, each as a `**Bold**` label with `- ` bullets under it:',
  '  - **Highlights** — the substance: what was talked through, problems, context, news.',
  '  - **Decisions** — anything settled or agreed.',
  '  - **Action items** — concrete next steps; name the owner when it is clear ("You to…", "Alex to…").',
  '  Omit any section that would be empty. A short call may have only a gist line and a couple of highlights.',
  '',
  'Rules:',
  '- Be specific and write in the active voice. Capture real details — names, numbers, plans, feelings, problems.',
  '- NEVER use vague filler like "It was noted that…", "The speaker mentioned…", or hollow restatements.',
  '- Skip greetings, small talk, and transitions.',
  '- No checkboxes (`- [ ]`), no nested-bullet trees, no preamble like "Here is a summary".',
  '- Do not invent anything that was not said. If the call was brief or low-substance, keep it short — never pad.',
  '- Lines tagged ⟨low confidence⟩ were transcribed unreliably. Treat them cautiously:',
  '  do not state them as fact, never base a decision or action item on one alone, and',
  '  drop uncertain specifics (names, numbers) rather than guessing. The tag is metadata —',
  '  never repeat the ⟨low confidence⟩ marker in your output.',
  '',
  'Transcript:',
  '{{transcript}}',
].join('\n');
