import type { IGetBacklinksUseCase, NoteLink } from '../../../domain/ports/in/IGraphUseCases';
import type { GraphUseCasesDeps } from './types';

/**
 * Get notes that link TO a given note
 */
export class GetBacklinksUseCase implements IGetBacklinksUseCase {
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
