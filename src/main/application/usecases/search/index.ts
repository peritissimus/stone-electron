import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ISearchEngine } from '../../../domain/ports/out/ISearchEngine';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { ITagRepository } from '../../../domain/ports/out/ITagRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import type { IReranker } from '../../../domain/ports/out/IReranker';
import type { ISearchUseCases } from '../../../domain/ports/in/ISearchUseCases';
import { FullTextSearchUseCase } from './FullTextSearchUseCase';
import { SemanticSearchUseCase } from './SemanticSearchUseCase';
import { FindSimilarNotesUseCase } from './FindSimilarNotesUseCase';
import { HybridSearchUseCase } from './HybridSearchUseCase';
import { SearchByTagsUseCase } from './SearchByTagsUseCase';
import { SearchByDateRangeUseCase } from './SearchByDateRangeUseCase';
import { GetRelatedNotesUseCase } from './GetRelatedNotesUseCase';

export { FullTextSearchUseCase } from './FullTextSearchUseCase';
export { SemanticSearchUseCase } from './SemanticSearchUseCase';
export { FindSimilarNotesUseCase } from './FindSimilarNotesUseCase';
export { HybridSearchUseCase } from './HybridSearchUseCase';
export { SearchByTagsUseCase } from './SearchByTagsUseCase';
export { SearchByDateRangeUseCase } from './SearchByDateRangeUseCase';
export { GetRelatedNotesUseCase } from './GetRelatedNotesUseCase';

export interface SearchUseCasesDeps {
  noteRepository: INoteRepository;
  searchEngine: ISearchEngine;
  embedder: IEmbedder;
  indexRepository: IIndexRepository;
  tagRepository: ITagRepository;
  noteLinkRepository: INoteLinkRepository;
  reranker?: IReranker;
}

export function createSearchUseCases(deps: SearchUseCasesDeps): ISearchUseCases {
  const {
    noteRepository,
    searchEngine,
    embedder,
    indexRepository,
    tagRepository,
    noteLinkRepository,
    reranker,
  } = deps;

  return {
    fullTextSearch: new FullTextSearchUseCase(noteRepository, searchEngine),
    semanticSearch: new SemanticSearchUseCase(embedder, indexRepository),
    findSimilarNotes: new FindSimilarNotesUseCase(noteRepository, indexRepository),
    hybridSearch: new HybridSearchUseCase(noteRepository, embedder, indexRepository, reranker),
    searchByTags: new SearchByTagsUseCase(noteRepository),
    searchByDateRange: new SearchByDateRangeUseCase(noteRepository),
    getRelatedNotes: new GetRelatedNotesUseCase(
      noteRepository,
      indexRepository,
      tagRepository,
      noteLinkRepository,
    ),
  };
}
