import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export interface GraphUseCasesDeps {
  noteRepository: INoteRepository;
  noteLinkRepository: INoteLinkRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}
