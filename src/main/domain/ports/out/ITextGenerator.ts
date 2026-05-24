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

export interface ITextGenerator {
  generateAnswer(request: GenerateAnswerRequest): Promise<GenerateAnswerResponse>;
}
