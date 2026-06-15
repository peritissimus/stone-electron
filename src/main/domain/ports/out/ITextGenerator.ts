export interface CitationSource {
  chunkId: string;
  noteId: string;
  title: string;
  headingPath?: string[];
  excerpt: string;
  /** Source date (YYYY-MM-DD) when known — e.g. a journal entry — so the
   *  model can reason about temporal questions ("what did we do on the 13th"). */
  date?: string;
}

export interface GenerateAnswerRequest {
  query: string;
  sources: CitationSource[];
  /** Today's date (YYYY-MM-DD) for grounding relative temporal references. */
  today?: string;
  model?: string;
}

export interface GenerateAnswerResponse {
  text: string;
  usedSources: CitationSource[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface GenerateMarkdownRequest {
  /** User prompt (markdown-producing). Caller is responsible for any
   *  templating; the generator does not interpolate variables. */
  prompt: string;
  /** Optional system message; defaults to a markdown-formatting nudge. */
  system?: string;
  /** Override the configured text model. */
  model?: string;
  temperature?: number;
}

export interface GenerateMarkdownResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * LLM-generated retrieval plan. Turns a natural-language question into a
 * cleaner search query and resolves any temporal reference ("the 13th",
 * "day before yesterday", "last week") into an absolute date range, so the
 * Ask flow can fetch the right dated notes instead of matching literal words.
 */
export interface QueryPlan {
  /** Rewritten/expanded query for retrieval (keywords; date words stripped). */
  searchQuery: string;
  /** Range start (YYYY-MM-DD), or null when the question isn't date-scoped. */
  dateStart: string | null;
  /** Range end (YYYY-MM-DD); equals dateStart for a single day, null when not date-scoped. */
  dateEnd: string | null;
}

export interface PlanQueryRequest {
  query: string;
  /** Today's date as YYYY-MM-DD so the model can resolve relative references. */
  today: string;
  model?: string;
}

export interface ITextGenerator {
  generateAnswer(request: GenerateAnswerRequest): Promise<GenerateAnswerResponse>;
  /**
   * Use the LLM to turn a natural-language question into a retrieval plan:
   * a cleaned search query plus any resolved date range. Implementations must
   * degrade gracefully (return the original query, no dates) on any failure.
   */
  planQuery(request: PlanQueryRequest): Promise<QueryPlan>;
  /**
   * Generic markdown generation — used by features (meeting summarizer,
   * suggest-links, etc.) that don't fit the AskNotes-citations shape.
   */
  generateMarkdown(request: GenerateMarkdownRequest): Promise<GenerateMarkdownResponse>;
}
