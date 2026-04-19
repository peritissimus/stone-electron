import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../../domain/ports/out/IVersionRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IVersionUseCases } from '../../../domain/ports/in/IVersionUseCases';
import { GetVersionsUseCase } from './GetVersionsUseCase';
import { CreateVersionUseCase } from './CreateVersionUseCase';
import { RestoreVersionUseCase } from './RestoreVersionUseCase';
import { GetVersionUseCase } from './GetVersionUseCase';

export { GetVersionsUseCase } from './GetVersionsUseCase';
export { CreateVersionUseCase } from './CreateVersionUseCase';
export { RestoreVersionUseCase } from './RestoreVersionUseCase';
export { GetVersionUseCase } from './GetVersionUseCase';

export interface VersionUseCasesDeps {
  noteRepository: INoteRepository;
  versionRepository: IVersionRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

export function createVersionUseCases(deps: VersionUseCasesDeps): IVersionUseCases {
  const { noteRepository, versionRepository, workspaceRepository, fileStorage } = deps;

  return {
    getVersions: new GetVersionsUseCase(noteRepository, versionRepository),
    createVersion: new CreateVersionUseCase(
      noteRepository,
      versionRepository,
      workspaceRepository,
      fileStorage,
    ),
    restoreVersion: new RestoreVersionUseCase(
      noteRepository,
      versionRepository,
      workspaceRepository,
      fileStorage,
    ),
    getVersion: new GetVersionUseCase(versionRepository),
  };
}
