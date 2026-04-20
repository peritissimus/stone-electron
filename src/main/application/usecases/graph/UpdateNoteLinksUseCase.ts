import type { IUpdateNoteLinksUseCase } from '../../../domain/ports/in/IGraphUseCases';
import { LinkExtractor } from '../../../domain/services/LinkExtractor';
import { NoteLinkEntity } from '../../../domain/entities';
import { logger } from '../../../shared/utils';
import type { GraphUseCasesDeps } from './types';

/**
 * Update links for a note after content change
 */
export class UpdateNoteLinksUseCase implements IUpdateNoteLinksUseCase {
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
