/**
 * ISummarizationStrategy — turns a meeting transcript into a markdown
 * summary suitable for journal append.
 *
 * v1 ships a SingleShot strategy. Long-meeting (map-reduce) and
 * hierarchical strategies implement the same port without changing the
 * use case. Strategies own their own LLM calls via ITextGenerator.
 */

export interface SummarizeRequest {
  transcript: string;
  /** User-overridable prompt template; must include the `{{transcript}}`
   *  placeholder. Strategies replace that token with the transcript
   *  (or per-chunk transcript for map-reduce). */
  promptTemplate: string;
  /** Optional progress callback (e.g. `chunk 3/7`). */
  onProgress?: (info: SummarizeProgress) => void;
}

export interface SummarizeProgress {
  step: 'mapping' | 'reducing' | 'finalizing';
  current: number;
  total: number;
}

export interface SummarizeResult {
  summary: string;
  /** Echoed back so the use case can persist what was actually used. */
  promptUsed: string;
}

export interface ISummarizationStrategy {
  summarize(request: SummarizeRequest): Promise<SummarizeResult>;
}
