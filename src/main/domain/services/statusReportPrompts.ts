/**
 * Default prompt template for the weekly status report generator.
 *
 * Receives the rendered "evidence packet" (journal entries, meeting
 * summaries, recently-modified notes, completed tasks from the past
 * week) and asks the LLM to draft a markdown status report in the
 * voice of an IC reporting to a manager.
 */

export const DEFAULT_STATUS_REPORT_PROMPT = [
  'You are drafting a weekly status report for a senior individual contributor.',
  'Synthesize the evidence below into a concise markdown status with exactly these sections:',
  '',
  '## Shipped',
  '- Bullets describing what was completed or merged this week. Past tense, concrete.',
  '',
  '## In progress',
  '- Bullets describing work that is actively moving but not done.',
  '',
  '## Decisions made',
  '- Bullets describing concrete decisions or directional choices made this week.',
  '',
  '## Blockers / asks',
  '- Bullets describing what is blocked, or what the IC needs from others. Omit the section if there are none.',
  '',
  'Rules:',
  '- Use ONLY information that appears in the evidence. Do not invent context, owners, dates, or links.',
  '- Keep bullets short and concrete. Skip filler.',
  '- Output the report directly with no preamble or closing remarks.',
  '- If the evidence is sparse, write fewer bullets — do NOT pad.',
  '',
  'Evidence:',
  '{{evidence}}',
].join('\n');
