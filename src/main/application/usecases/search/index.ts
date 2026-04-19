import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ISearchEngine } from '../../../domain/ports/out/ISearchEngine';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { ISearchUseCases } from '../../../domain/ports/in/ISearchUseCases';
import { FullTextSearchUseCase } from './FullTextSearchUseCase';
import { SemanticSearchUseCase } from './SemanticSearchUseCase';
import { FindSimilarNotesUseCase } from './FindSimilarNotesUseCase';
import { RebuildSearchIndexUseCase } from './RebuildSearchIndexUseCase';
import { HybridSearchUseCase } from './HybridSearchUseCase';
import { SearchByTagsUseCase } from './SearchByTagsUseCase';
import { SearchByDateRangeUseCase } from './SearchByDateRangeUseCase';

export { FullTextSearchUseCase } from './FullTextSearchUseCase';
export { SemanticSearchUseCase } from './SemanticSearchUseCase';
export { FindSimilarNotesUseCase } from './FindSimilarNotesUseCase';
export { RebuildSearchIndexUseCase } from './RebuildSearchIndexUseCase';
export { HybridSearchUseCase } from './HybridSearchUseCase';
export { SearchByTagsUseCase } from './SearchByTagsUseCase';
export { SearchByDateRangeUseCase } from './SearchByDateRangeUseCase';

export interface SearchUseCasesDeps {
  noteRepository: INoteRepository;
  searchEngine: ISearchEngine;
  embedder: IEmbedder;
}

export function createSearchUseCases(deps: SearchUseCasesDeps): ISearchUseCases {
  const { noteRepository, searchEngine, embedder } = deps;

  return {
    fullTextSearch: new FullTextSearchUseCase(noteRepository, searchEngine),
    semanticSearch: new SemanticSearchUseCase(noteRepository, embedder),
    findSimilarNotes: new FindSimilarNotesUseCase(noteRepository, embedder),
    rebuildIndex: new RebuildSearchIndexUseCase(searchEngine),
    hybridSearch: new HybridSearchUseCase(noteRepository, searchEngine, embedder),
    searchByTags: new SearchByTagsUseCase(noteRepository),
    searchByDateRange: new SearchByDateRangeUseCase(noteRepository),
  };
}
