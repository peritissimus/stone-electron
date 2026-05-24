import type {
  ISummarizeNoteUseCase,
  SummarizeNoteRequest,
  SummarizeNoteResponse,
} from '../../../domain/ports/in/IAIUseCases';
import type { IMarkdownProcessor, INoteRepository, ITextGenerator } from '../../../domain';

const MAX_SUMMARY_SOURCE_LENGTH = 5000;

function excerpt(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SUMMARY_SOURCE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_SUMMARY_SOURCE_LENGTH).trim()}...`;
}

export class SummarizeNoteUseCase implements ISummarizeNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly textGenerator: ITextGenerator,
  ) {}

  async execute(request: SummarizeNoteRequest): Promise<SummarizeNoteResponse> {
    const note = await this.noteRepository.findById(request.noteId);
    if (!note) {
      throw new Error(`Note not found: ${request.noteId}`);
    }

    const content = await this.noteRepository.getContentById(request.noteId);
    if (!content) {
      return { summary: '', sources: [] };
    }

    const plainText = await this.markdownProcessor.extractPlainText(content);
    const source = {
      chunkId: note.id,
      noteId: note.id,
      title: note.title || 'Untitled',
      excerpt: excerpt(plainText),
    };

    const answer = await this.textGenerator.generateAnswer({
      query: `Summarize this note: ${source.title}`,
      sources: [source],
    });

    return {
      summary: answer.text,
      sources: answer.usedSources,
    };
  }
}
