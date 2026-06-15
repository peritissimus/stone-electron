import type { IGraphUseCases } from '../../../domain/ports/in/IGraphUseCases';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import { GetBacklinksUseCase } from './GetBacklinksUseCase';
import { GetForwardLinksUseCase } from './GetForwardLinksUseCase';
import { GetGraphDataUseCase } from './GetGraphDataUseCase';
import { UpdateNoteLinksUseCase } from './UpdateNoteLinksUseCase';

/** Shared dependency bundle for the graph use cases. */
export interface GraphUseCasesDeps {
  noteRepository: INoteRepository;
  noteLinkRepository: INoteLinkRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

export { GetBacklinksUseCase } from './GetBacklinksUseCase';
export { GetForwardLinksUseCase } from './GetForwardLinksUseCase';
export { GetGraphDataUseCase } from './GetGraphDataUseCase';
export { UpdateNoteLinksUseCase } from './UpdateNoteLinksUseCase';

export function createGraphUseCases(deps: GraphUseCasesDeps): IGraphUseCases {
  return {
    getBacklinks: new GetBacklinksUseCase(deps),
    getForwardLinks: new GetForwardLinksUseCase(deps),
    getGraphData: new GetGraphDataUseCase(deps),
    updateNoteLinks: new UpdateNoteLinksUseCase(deps),
  };
}
