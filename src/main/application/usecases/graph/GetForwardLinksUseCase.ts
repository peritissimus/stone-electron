import type { IGetForwardLinksUseCase, NoteLink } from '../../../domain/ports/in/IGraphUseCases';
import type { GraphUseCasesDeps } from './GetBacklinksUseCase';

/**
 * Get notes that a given note links TO
 */
export class GetForwardLinksUseCase implements IGetForwardLinksUseCase {
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
