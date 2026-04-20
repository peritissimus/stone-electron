import type { IGraphUseCases } from '../../../domain/ports/in/IGraphUseCases';
import type { GraphUseCasesDeps } from './types';
import { GetBacklinksUseCase } from './GetBacklinksUseCase';
import { GetForwardLinksUseCase } from './GetForwardLinksUseCase';
import { GetGraphDataUseCase } from './GetGraphDataUseCase';
import { UpdateNoteLinksUseCase } from './UpdateNoteLinksUseCase';

export type { GraphUseCasesDeps } from './types';
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
