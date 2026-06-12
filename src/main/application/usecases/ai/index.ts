import type {
  IAIUseCases,
  IIndexRepository,
  IMarkdownProcessor,
  INoteRepository,
  ITextGenerator,
} from '../../../domain';
import type { ITranscriber } from '../../../domain/ports/out/ITranscriber';
import type { IHybridSearchUseCase } from '../../../domain/ports/in/ISearchUseCases';
import { AskNotesUseCase } from './AskNotesUseCase';
import { SummarizeNoteUseCase } from './SummarizeNoteUseCase';
import { SuggestLinksUseCase } from './SuggestLinksUseCase';
import { WarmUpTranscriberUseCase } from './WarmUpTranscriberUseCase';

export { AskNotesUseCase } from './AskNotesUseCase';
export { SummarizeNoteUseCase } from './SummarizeNoteUseCase';
export { SuggestLinksUseCase } from './SuggestLinksUseCase';
export { WarmUpTranscriberUseCase } from './WarmUpTranscriberUseCase';

export interface AIUseCasesDeps {
  hybridSearch: IHybridSearchUseCase;
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
  textGenerator: ITextGenerator;
  indexRepository: IIndexRepository;
  transcriber: ITranscriber;
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
    warmUpTranscriber: new WarmUpTranscriberUseCase(deps.transcriber),
  };
}
