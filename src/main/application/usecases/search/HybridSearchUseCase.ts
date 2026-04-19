import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ISearchEngine } from '../../../domain/ports/out/ISearchEngine';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  IHybridSearchUseCase,
  HybridSearchRequest,
  HybridSearchResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class HybridSearchUseCase implements IHybridSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
    private readonly embedder: IEmbedder,
  ) {}

  async execute(request: HybridSearchRequest): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    const limit = request.limit || 50;

    // Use full-text search as primary (can be enhanced with semantic later)
    const ftsResults = await this.searchEngine.searchFullText(request.query, {
      workspaceId: request.workspaceId,
      limit,
    });

    const queryTimeMs = Date.now() - startTime;

    return {
      results: ftsResults.map((r) => ({
        note: r.note,
        score: 1,
        searchType: 'fts' as const,
      })),
      total: ftsResults.length,
      queryTimeMs,
    };
  }
}
