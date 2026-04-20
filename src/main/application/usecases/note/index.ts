import type {
  INoteRepository,
  IFileStorage,
  IMarkdownProcessor,
  INoteUseCases,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import { CreateNoteUseCase } from './CreateNoteUseCase';
import { UpdateNoteUseCase } from './UpdateNoteUseCase';
import { GetNoteUseCase } from './GetNoteUseCase';
import { ListNotesUseCase } from './ListNotesUseCase';
import { DeleteNoteUseCase } from './DeleteNoteUseCase';
import { RestoreNoteUseCase } from './RestoreNoteUseCase';
import { MoveNoteUseCase } from './MoveNoteUseCase';
import { SearchNotesUseCase } from './SearchNotesUseCase';
import { GetNoteContentUseCase } from './GetNoteContentUseCase';
import { SaveNoteContentUseCase } from './SaveNoteContentUseCase';
import { GetNoteByPathUseCase } from './GetNoteByPathUseCase';
import { ToggleFavoriteUseCase } from './ToggleFavoriteUseCase';
import { TogglePinUseCase } from './TogglePinUseCase';
import { ToggleArchiveUseCase } from './ToggleArchiveUseCase';

export { CreateNoteUseCase } from './CreateNoteUseCase';
export { UpdateNoteUseCase } from './UpdateNoteUseCase';
export { GetNoteUseCase } from './GetNoteUseCase';
export { ListNotesUseCase } from './ListNotesUseCase';
export { DeleteNoteUseCase } from './DeleteNoteUseCase';
export { RestoreNoteUseCase } from './RestoreNoteUseCase';
export { MoveNoteUseCase } from './MoveNoteUseCase';
export { SearchNotesUseCase } from './SearchNotesUseCase';
export { GetNoteContentUseCase } from './GetNoteContentUseCase';
export { SaveNoteContentUseCase } from './SaveNoteContentUseCase';
export { GetNoteByPathUseCase } from './GetNoteByPathUseCase';
export { ToggleFavoriteUseCase } from './ToggleFavoriteUseCase';
export { TogglePinUseCase } from './TogglePinUseCase';
export { ToggleArchiveUseCase } from './ToggleArchiveUseCase';

export interface NoteUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher?: IEventPublisher;
}

export function createNoteUseCases(deps: NoteUseCasesDeps): INoteUseCases {
  const { noteRepository, workspaceRepository, fileStorage, markdownProcessor, eventPublisher } =
    deps;

  return {
    createNote: new CreateNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      eventPublisher,
    ),
    updateNote: new UpdateNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      eventPublisher,
    ),
    getNote: new GetNoteUseCase(noteRepository, workspaceRepository, fileStorage),
    listNotes: new ListNotesUseCase(noteRepository, workspaceRepository),
    deleteNote: new DeleteNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      eventPublisher,
    ),
    restoreNote: new RestoreNoteUseCase(noteRepository, eventPublisher),
    moveNote: new MoveNoteUseCase(noteRepository, eventPublisher),
    searchNotes: new SearchNotesUseCase(noteRepository, workspaceRepository),
    getNoteContent: new GetNoteContentUseCase(noteRepository, workspaceRepository, fileStorage),
    saveNoteContent: new SaveNoteContentUseCase(noteRepository, workspaceRepository, fileStorage),
    getNoteByPath: new GetNoteByPathUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      eventPublisher,
    ),
    toggleFavorite: new ToggleFavoriteUseCase(noteRepository, eventPublisher),
    togglePin: new TogglePinUseCase(noteRepository, eventPublisher),
    toggleArchive: new ToggleArchiveUseCase(noteRepository, eventPublisher),
  };
}
