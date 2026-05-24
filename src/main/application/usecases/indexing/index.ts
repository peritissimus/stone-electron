import type {
  IEmbedder,
  IFileStorage,
  IIndexRepository,
  INoteRepository,
  IPathService,
  IWorkspaceRepository,
} from '../../../domain';
import type { IIndexUseCases } from '../../../domain/ports/in/IIndexUseCases';
import { IndexNoteUseCase } from './IndexNoteUseCase';
import { RebuildAllNotesIndexUseCase } from './RebuildAllNotesIndexUseCase';

export { IndexNoteUseCase } from './IndexNoteUseCase';
export { RebuildAllNotesIndexUseCase } from './RebuildAllNotesIndexUseCase';

export interface IndexUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  embedder: IEmbedder;
  indexRepository: IIndexRepository;
  pathService: IPathService;
}

export function createIndexUseCases(deps: IndexUseCasesDeps): IIndexUseCases {
  const indexNote = new IndexNoteUseCase(
    deps.noteRepository,
    deps.workspaceRepository,
    deps.fileStorage,
    deps.embedder,
    deps.indexRepository,
    deps.pathService,
  );

  return {
    indexNote,
    rebuildAll: new RebuildAllNotesIndexUseCase(
      deps.noteRepository,
      deps.workspaceRepository,
      indexNote,
    ),
  };
}
