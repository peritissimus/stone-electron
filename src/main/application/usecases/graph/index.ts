import type { IGraphUseCases } from '../../../domain/ports/in/IGraphUseCases';
import { GetBacklinksUseCase, type GraphUseCasesDeps } from './GetBacklinksUseCase';
import { GetForwardLinksUseCase } from './GetForwardLinksUseCase';
import { GetGraphDataUseCase } from './GetGraphDataUseCase';
import { UpdateNoteLinksUseCase } from './UpdateNoteLinksUseCase';

export { GetBacklinksUseCase, type GraphUseCasesDeps } from './GetBacklinksUseCase';
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
