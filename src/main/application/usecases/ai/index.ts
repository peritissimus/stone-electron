import type {
  IAIUseCases,
  IIndexRepository,
  IMarkdownProcessor,
  INoteRepository,
  ITextGenerator,
} from '../../../domain';
import type { IHybridSearchUseCase } from '../../../domain/ports/in/ISearchUseCases';
import { AskNotesUseCase } from './AskNotesUseCase';
import { SummarizeNoteUseCase } from './SummarizeNoteUseCase';
import { SuggestLinksUseCase } from './SuggestLinksUseCase';

export { AskNotesUseCase } from './AskNotesUseCase';
export { SummarizeNoteUseCase } from './SummarizeNoteUseCase';
export { SuggestLinksUseCase } from './SuggestLinksUseCase';

export interface AIUseCasesDeps {
  hybridSearch: IHybridSearchUseCase;
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
  textGenerator: ITextGenerator;
  indexRepository: IIndexRepository;
}

export function createAIUseCases(deps: AIUseCasesDeps): IAIUseCases {
  return {
    askNotes: new AskNotesUseCase(deps.hybridSearch, deps.noteRepository, deps.textGenerator),
    summarizeNote: new SummarizeNoteUseCase(
      deps.noteRepository,
      deps.markdownProcessor,
      deps.textGenerator,
    ),
    suggestLinks: new SuggestLinksUseCase(deps.noteRepository, deps.indexRepository),
  };
}
