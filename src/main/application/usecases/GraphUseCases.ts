/**
 * Graph Use Cases - Link analysis and graph visualization
 */

import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { INoteLinkRepository } from '../../domain/ports/out/INoteLinkRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type {
  IGraphUseCases,
  IGetBacklinksUseCase,
  IGetForwardLinksUseCase,
  IGetGraphDataUseCase,
  IUpdateNoteLinksUseCase,
  NoteLink,
  GraphData,
} from '../../domain/ports/in/IGraphUseCases';
import { LinkExtractor } from '../../domain/services/LinkExtractor';
import { NoteGraphBuilder } from '../../domain/services/NoteGraphBuilder';
import { NoteLinkEntity } from '../../domain/entities';
import { logger } from '../../shared/utils';

export interface GraphUseCasesDeps {
  noteRepository: INoteRepository;
  noteLinkRepository: INoteLinkRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

/**
 * Get notes that link TO a given note
 */
class GetBacklinksUseCase implements IGetBacklinksUseCase {
  constructor(private deps: GraphUseCasesDeps) {}

  async execute(noteId: string): Promise<NoteLink[]> {
    const { noteRepository, noteLinkRepository } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get notes that link to this note
    const sourceNotes = await noteLinkRepository.getBacklinks(noteId);

    return sourceNotes.map((sourceNote) => ({
      sourceId: sourceNote.id,
      sourceTitle: sourceNote.title || 'Untitled',
      targetId: noteId,
      targetTitle: note.title || 'Untitled',
      linkText: '',
    }));
  }
}

/**
 * Get notes that a given note links TO
 */
class GetForwardLinksUseCase implements IGetForwardLinksUseCase {
  constructor(private deps: GraphUseCasesDeps) {}

  async execute(noteId: string): Promise<NoteLink[]> {
    const { noteRepository, noteLinkRepository } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get notes this note links to
    const targetNotes = await noteLinkRepository.getForwardLinks(noteId);

    return targetNotes.map((targetNote) => ({
      sourceId: noteId,
      sourceTitle: note.title || 'Untitled',
      targetId: targetNote.id,
      targetTitle: targetNote.title || 'Untitled',
      linkText: '',
    }));
  }
}

/**
 * Get graph data for visualization
 */
class GetGraphDataUseCase implements IGetGraphDataUseCase {
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

/**
 * Update links for a note after content change
 */
class UpdateNoteLinksUseCase implements IUpdateNoteLinksUseCase {
  constructor(private deps: GraphUseCasesDeps) {}

  async execute(noteId: string, content: string): Promise<void> {
    const { noteRepository, noteLinkRepository } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Extract referenced note titles from content
    const referencedTitles = LinkExtractor.getReferencedNoteTitles(content);

    // Delete existing links from this note
    await noteLinkRepository.deleteFromNote(noteId);

    // Find target notes by title and create links
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) return;

    for (const title of referencedTitles) {
      const targetNotes = await noteRepository.findAll({
        workspaceId: activeWorkspace.id,
        isDeleted: false,
      });

      const targetNote = targetNotes.find((n) => n.title?.toLowerCase() === title.toLowerCase());

      if (targetNote && targetNote.id !== noteId) {
        const linkEntity = NoteLinkEntity.create({
          sourceNoteId: noteId,
          targetNoteId: targetNote.id,
        });

        await noteLinkRepository.save(linkEntity);
      }
    }

    logger.info(
      `[GraphUseCases] Updated links for note ${noteId}: ${referencedTitles.length} references`,
    );
  }
}

export function createGraphUseCases(deps: GraphUseCasesDeps): IGraphUseCases {
  return {
    getBacklinks: new GetBacklinksUseCase(deps),
    getForwardLinks: new GetForwardLinksUseCase(deps),
    getGraphData: new GetGraphDataUseCase(deps),
    updateNoteLinks: new UpdateNoteLinksUseCase(deps),
  };
}
