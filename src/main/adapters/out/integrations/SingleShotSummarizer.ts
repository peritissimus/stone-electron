/**
 * SingleShotSummarizer — feeds the full transcript to the LLM in one call.
 *
 * Good for meetings up to ~30 min where the transcript fits in a normal
 * context window. Longer meetings can swap to a map-reduce strategy without
 * touching the use case — both implement ISummarizationStrategy.
 */

import type {
  ISummarizationStrategy,
  ITextGenerator,
  SummarizeRequest,
  SummarizeResult,
} from '../../../domain';

// Default prompt lives in domain/services/meetingSummaryPrompts.ts — re-exported
// here for callers that previously imported it from this module path.
export { DEFAULT_MEETING_SUMMARY_PROMPT } from '../../../domain';

export interface SingleShotSummarizerDeps {
  textGenerator: ITextGenerator;
}

export class SingleShotSummarizer implements ISummarizationStrategy {
  constructor(private readonly deps: SingleShotSummarizerDeps) {}

  async summarize(request: SummarizeRequest): Promise<SummarizeResult> {
    request.onProgress?.({ step: 'finalizing', current: 0, total: 1 });

    const prompt = renderPrompt(request.promptTemplate, request.transcript);
    const response = await this.deps.textGenerator.generateMarkdown({
      prompt,
      // Override the generic markdown system prompt — which suggests
      // "headings where useful" — so it doesn't fight the user prompt.
      system:
        'You produce only the markdown the user asks for. Output the result directly with no preamble or closing remarks.',
    });

    request.onProgress?.({ step: 'finalizing', current: 1, total: 1 });

    return {
      summary: response.text.trim(),
      promptUsed: request.promptTemplate,
    };
  }
}

function renderPrompt(template: string, transcript: string): string {
  if (template.includes('{{transcript}}')) {
    return template.replaceAll('{{transcript}}', transcript);
  }
  // Tolerate templates that forgot the placeholder — append at the end.
  return `${template}\n\nTranscript:\n${transcript}`;
}
