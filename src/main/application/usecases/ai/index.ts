import type {
  IAIUseCases,
  IAppConfigRepository,
  IIndexRepository,
  IJournalReader,
  IMarkdownProcessor,
  INoteRepository,
  ITextGenerator,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
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
  journalReader: IJournalReader;
  workspaceRepository: IWorkspaceRepository;
  appConfigRepository: IAppConfigRepository;
}

export function createAIUseCases(deps: AIUseCasesDeps): IAIUseCases {
  return {
    askNotes: new AskNotesUseCase(
      deps.hybridSearch,
      deps.noteRepository,
      deps.textGenerator,
      deps.journalReader,
      deps.workspaceRepository,
      deps.appConfigRepository,
    ),
    summarizeNote: new SummarizeNoteUseCase(
      deps.noteRepository,
      deps.markdownProcessor,
      deps.textGenerator,
    ),
    suggestLinks: new SuggestLinksUseCase(deps.noteRepository, deps.indexRepository),
  };
}
