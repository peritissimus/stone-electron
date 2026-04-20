import type { IGetGraphDataUseCase, GraphData } from '../../../domain/ports/in/IGraphUseCases';
import { NoteGraphBuilder } from '../../../domain/services/NoteGraphBuilder';
import type { GraphUseCasesDeps } from './types';

/**
 * Get graph data for visualization
 */
export class GetGraphDataUseCase implements IGetGraphDataUseCase {
  constructor(private deps: GraphUseCasesDeps) {}

  async execute(options?: {
    centerNoteId?: string;
    depth?: number;
    includeOrphans?: boolean;
  }): Promise<GraphData> {
    const { noteRepository, noteLinkRepository, workspaceRepository } = this.deps;

    // Get active workspace
    const activeWorkspace = await workspaceRepository.findActive();
    if (!activeWorkspace) {
      return { nodes: [], links: [] };
    }

    // Get all notes for active workspace only
    const allNotes = await noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    const allLinks = await noteLinkRepository.findAll();

    return NoteGraphBuilder.buildGraphData(allNotes, allLinks, options ?? {});
  }
}
