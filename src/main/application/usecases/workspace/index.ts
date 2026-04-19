import type {
  IWorkspaceRepository,
  IWorkspaceUseCases,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import { CreateWorkspaceUseCase } from './CreateWorkspaceUseCase';
import { GetWorkspaceUseCase } from './GetWorkspaceUseCase';
import { ListWorkspacesUseCase } from './ListWorkspacesUseCase';
import { SetActiveWorkspaceUseCase } from './SetActiveWorkspaceUseCase';
import { GetActiveWorkspaceUseCase } from './GetActiveWorkspaceUseCase';
import { DeleteWorkspaceUseCase } from './DeleteWorkspaceUseCase';
import { UpdateWorkspaceUseCase } from './UpdateWorkspaceUseCase';
import { SelectFolderUseCase } from './SelectFolderUseCase';
import { ValidatePathUseCase } from './ValidatePathUseCase';
import { CreateFolderUseCase } from './CreateFolderUseCase';
import { RenameFolderUseCase } from './RenameFolderUseCase';
import { DeleteFolderUseCase } from './DeleteFolderUseCase';
import { MoveFolderUseCase } from './MoveFolderUseCase';
import { ScanWorkspaceUseCase } from './ScanWorkspaceUseCase';
import { SyncWorkspaceUseCase } from './SyncWorkspaceUseCase';

export { CreateWorkspaceUseCase } from './CreateWorkspaceUseCase';
export { GetWorkspaceUseCase } from './GetWorkspaceUseCase';
export { ListWorkspacesUseCase } from './ListWorkspacesUseCase';
export { SetActiveWorkspaceUseCase } from './SetActiveWorkspaceUseCase';
export { GetActiveWorkspaceUseCase } from './GetActiveWorkspaceUseCase';
export { DeleteWorkspaceUseCase } from './DeleteWorkspaceUseCase';
export { UpdateWorkspaceUseCase } from './UpdateWorkspaceUseCase';
export { SelectFolderUseCase } from './SelectFolderUseCase';
export { ValidatePathUseCase } from './ValidatePathUseCase';
export { CreateFolderUseCase } from './CreateFolderUseCase';
export { RenameFolderUseCase } from './RenameFolderUseCase';
export { DeleteFolderUseCase } from './DeleteFolderUseCase';
export { MoveFolderUseCase } from './MoveFolderUseCase';
export { ScanWorkspaceUseCase } from './ScanWorkspaceUseCase';
export { SyncWorkspaceUseCase } from './SyncWorkspaceUseCase';

export interface WorkspaceUseCasesDeps {
  workspaceRepository: IWorkspaceRepository;
  noteRepository: INoteRepository;
  fileStorage: IFileStorage;
  systemBridge: ISystemBridge;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher?: IEventPublisher;
}

export function createWorkspaceUseCases(deps: WorkspaceUseCasesDeps): IWorkspaceUseCases {
  const { workspaceRepository, noteRepository, fileStorage, systemBridge, markdownProcessor, eventPublisher } = deps;

  return {
    createWorkspace: new CreateWorkspaceUseCase(workspaceRepository, eventPublisher),
    getWorkspace: new GetWorkspaceUseCase(workspaceRepository),
    listWorkspaces: new ListWorkspacesUseCase(workspaceRepository),
    setActiveWorkspace: new SetActiveWorkspaceUseCase(workspaceRepository, eventPublisher),
    getActiveWorkspace: new GetActiveWorkspaceUseCase(workspaceRepository),
    deleteWorkspace: new DeleteWorkspaceUseCase(workspaceRepository, eventPublisher),
    updateWorkspace: new UpdateWorkspaceUseCase(workspaceRepository, eventPublisher),
    selectFolder: new SelectFolderUseCase(systemBridge),
    validatePath: new ValidatePathUseCase(systemBridge),
    createFolder: new CreateFolderUseCase(workspaceRepository, fileStorage),
    renameFolder: new RenameFolderUseCase(workspaceRepository, fileStorage),
    deleteFolder: new DeleteFolderUseCase(workspaceRepository, fileStorage),
    moveFolder: new MoveFolderUseCase(workspaceRepository, fileStorage),
    scanWorkspace: new ScanWorkspaceUseCase(workspaceRepository, fileStorage),
    syncWorkspace: new SyncWorkspaceUseCase(
      workspaceRepository,
      noteRepository,
      fileStorage,
      markdownProcessor,
      eventPublisher,
    ),
  };
}
