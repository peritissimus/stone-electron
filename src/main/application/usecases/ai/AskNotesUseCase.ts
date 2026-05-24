import type {
  AskNotesRequest,
  AskNotesResponse,
  IAskNotesUseCase,
} from '../../../domain/ports/in/IAIUseCases';
import type { INoteRepository, ITextGenerator } from '../../../domain';
import type { CitationSource } from '../../../domain/ports/out/ITextGenerator';
import type { IHybridSearchUseCase } from '../../../domain/ports/in/ISearchUseCases';

const DEFAULT_NOTE_LIMIT = 5;
const MAX_CITATION_CHUNKS = 8;

/**
 * AskNotes — chunk-level retrieval + LLM synthesis.
 *
 * The retrieval pipeline lives in HybridSearchUseCase; this use case is the
 * thin shell that picks the best chunks across the top notes and forms the
 * citation list the text generator consumes. Citations are chunk-grained so
 * the model gets focused passages (instead of whole-note plain text) and the
 * user sees the actual heading path that matched their question.
 */
export class AskNotesUseCase implements IAskNotesUseCase {
  constructor(
    private readonly hybridSearch: IHybridSearchUseCase,
    private readonly noteRepository: INoteRepository,
    private readonly textGenerator: ITextGenerator,
  ) {}

  async execute(request: AskNotesRequest): Promise<AskNotesResponse> {
    const noteLimit = request.limit ?? DEFAULT_NOTE_LIMIT;
    const searchResponse = await this.hybridSearch.execute({
      query: request.query,
      workspaceId: request.workspaceId,
      limit: noteLimit,
    });

    const sources: CitationSource[] = [];

    for (const row of searchResponse.results) {
      if (sources.length >= MAX_CITATION_CHUNKS) break;
      const noteTitle = row.note.title || 'Untitled';

      if (row.chunks && row.chunks.length > 0) {
        for (const chunk of row.chunks) {
          if (sources.length >= MAX_CITATION_CHUNKS) break;
          if (!chunk.excerpt.trim()) continue;
          sources.push({
            chunkId: chunk.chunkId,
            noteId: chunk.noteId,
            title: noteTitle,
            headingPath: chunk.headingPath.length > 0 ? chunk.headingPath : undefined,
            excerpt: chunk.excerpt,
          });
        }
      } else {
        // Fallback for notes without chunks yet — load whole-note content.
        const content = await this.noteRepository.getContentById(row.note.id);
        if (!content || !content.trim()) continue;
        sources.push({
          chunkId: row.note.id,
          noteId: row.note.id,
          title: noteTitle,
          excerpt: shortExcerpt(content),
        });
      }
    }

    const answer = await this.textGenerator.generateAnswer({
      query: request.query,
      sources,
    });

    return {
      answer: answer.text,
      sources: answer.usedSources,
    };
  }
}

function shortExcerpt(text: string, max = 1400): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}
