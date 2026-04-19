import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGetBacklinksUseCase, NoteLink } from '../../../domain/ports/in/IGraphUseCases';

export interface GraphUseCasesDeps {
  noteRepository: INoteRepository;
  noteLinkRepository: INoteLinkRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

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
