export interface CitationSource {
  chunkId: string;
  noteId: string;
  title: string;
  headingPath?: string[];
  excerpt: string;
}

export interface GenerateAnswerRequest {
  query: string;
  sources: CitationSource[];
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

export interface ITextGenerator {
  generateAnswer(request: GenerateAnswerRequest): Promise<GenerateAnswerResponse>;
  /**
   * Generic markdown generation — used by features (meeting summarizer,
   * suggest-links, etc.) that don't fit the AskNotes-citations shape.
   */
  generateMarkdown(request: GenerateMarkdownRequest): Promise<GenerateMarkdownResponse>;
}
