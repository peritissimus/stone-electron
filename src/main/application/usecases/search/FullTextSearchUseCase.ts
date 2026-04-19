import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ISearchEngine } from '../../../domain/ports/out/ISearchEngine';
import type {
  IFullTextSearchUseCase,
  FullTextSearchRequest,
  FullTextSearchResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class FullTextSearchUseCase implements IFullTextSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
  ) {}

  async execute(request: FullTextSearchRequest): Promise<FullTextSearchResponse> {
    const results = await this.searchEngine.searchFullText(request.query, {
      workspaceId: request.workspaceId,
      limit: request.limit || 50,
    });

    return { results, total: results.length };
  }
}
