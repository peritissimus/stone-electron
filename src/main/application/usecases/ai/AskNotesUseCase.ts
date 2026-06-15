import type {
  AskNotesRequest,
  AskNotesResponse,
  IAskNotesUseCase,
} from '../../../domain/ports/in/IAIUseCases';
import type {
  IAppConfigRepository,
  IJournalReader,
  INoteRepository,
  ITextGenerator,
} from '../../../domain';
import type { CitationSource } from '../../../domain/ports/out/ITextGenerator';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IHybridSearchUseCase } from '../../../domain/ports/in/ISearchUseCases';
import { formatJournalDate, stripFirstHeading } from '../../../domain/services';

const DEFAULT_NOTE_LIMIT = 6;
const MAX_CITATION_CHUNKS = 10;
/** Cap how many days a single date-scoped question can pull in, so a vague
 *  range ("this year") can't drag the whole journal into the prompt. */
const MAX_JOURNAL_DAYS = 14;

/**
 * AskNotes — a small RAG orchestrator:
 *
 *   1. Query understanding — the LLM rewrites the question into a clean search
 *      query and resolves any temporal reference ("the 13th", "day before
 *      yesterday") into an absolute date range. (`textGenerator.planQuery`)
 *   2. Date-targeted retrieval — when a date range is resolved, the matching
 *      journal entries are fetched directly and become high-priority sources,
 *      so "what did we do on the 13th" reads the 13th's journal instead of
 *      hoping semantic search stumbles onto it.
 *   3. Hybrid retrieval — chunk-level semantic + keyword search fills the rest
 *      of the citation budget, deduped against the journal notes.
 *   4. Synthesis — the generator answers with today's date and each source's
 *      date in context.
 *
 * Every external step degrades gracefully: planning falls back to the literal
 * query, journal lookup failures are swallowed, and an empty source set yields
 * an honest "couldn't find it" from the generator.
 */
export class AskNotesUseCase implements IAskNotesUseCase {
  constructor(
    private readonly hybridSearch: IHybridSearchUseCase,
    private readonly noteRepository: INoteRepository,
    private readonly textGenerator: ITextGenerator,
    private readonly journalReader: IJournalReader,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly appConfigRepository: IAppConfigRepository,
  ) {}

  async execute(request: AskNotesRequest): Promise<AskNotesResponse> {
    const noteLimit = request.limit ?? DEFAULT_NOTE_LIMIT;
    const today = formatJournalDate(new Date());

    // 1. Query understanding (LLM). Falls back to the literal query on failure.
    const plan = await this.textGenerator.planQuery({ query: request.query, today });

    const sources: CitationSource[] = [];
    const seenNoteIds = new Set<string>();

    // 2. Date-targeted journal retrieval — highest priority for temporal Qs.
    if (plan.dateStart) {
      const journalSources = await this.fetchJournalSources(
        request.workspaceId,
        plan.dateStart,
        plan.dateEnd ?? plan.dateStart,
      );
      for (const source of journalSources) {
        if (sources.length >= MAX_CITATION_CHUNKS) break;
        sources.push(source);
        seenNoteIds.add(source.noteId);
      }
    }

    // 3. Hybrid retrieval with the rewritten query, deduped against journals.
    const searchResponse = await this.hybridSearch.execute({
      query: plan.searchQuery,
      workspaceId: request.workspaceId,
      limit: noteLimit,
    });

    for (const row of searchResponse.results) {
      if (sources.length >= MAX_CITATION_CHUNKS) break;
      if (seenNoteIds.has(row.note.id)) continue; // already covered by a journal source
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

    // 4. Synthesis with temporal grounding.
    const answer = await this.textGenerator.generateAnswer({
      query: request.query,
      sources,
      today,
    });

    return {
      answer: answer.text,
      sources: answer.usedSources,
    };
  }

  /**
   * Read journal entries within [startDate, endDate] and turn each non-empty
   * one into a dated citation source. Best-effort: any failure (no workspace,
   * unreadable files) yields an empty list rather than failing the whole ask.
   */
  private async fetchJournalSources(
    workspaceId: string | undefined,
    startDate: string,
    endDate: string,
  ): Promise<CitationSource[]> {
    try {
      const workspace = workspaceId
        ? await this.workspaceRepository.findById(workspaceId)
        : await this.workspaceRepository.findActive();
      if (!workspace) return [];

      // Guard against an over-broad range blowing up the prompt.
      const [oldest, newest] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
      if (daysBetween(oldest, newest) > MAX_JOURNAL_DAYS) return [];

      const config = await this.appConfigRepository.get();
      const records = await this.journalReader.findRecent({
        workspaceId: workspace.id,
        workspaceFolderPath: workspace.folderPath,
        journalFolder: config.notes.locationPolicy.journalFolder,
        oldestDate: oldest,
        newestDate: newest,
      });

      const sources: CitationSource[] = [];
      // Newest first — most recent day is usually the most relevant.
      for (const record of [...records].sort((a, b) => b.date.localeCompare(a.date))) {
        const body = record.content ? stripFirstHeading(record.content).trim() : '';
        if (!body) continue;
        sources.push({
          chunkId: `journal:${record.date}`,
          noteId: record.noteId,
          title: `Journal — ${record.date}`,
          excerpt: shortExcerpt(body),
          date: record.date,
        });
      }
      return sources;
    } catch {
      return [];
    }
  }
}

function shortExcerpt(text: string, max = 1400): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}

/** Whole-day span between two YYYY-MM-DD strings (UTC-safe, inclusive-ish). */
function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.abs(b - a) / 86_400_000;
}
