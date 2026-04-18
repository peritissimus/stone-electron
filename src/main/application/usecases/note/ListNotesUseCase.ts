import {
  type NoteProps,
  type INoteRepository,
  type IListNotesUseCase,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class ListNotesUseCase implements IListNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request: {
    workspaceId?: string;
    notebookId?: string | null;
    filter?: 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const workspaceId = request.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const filter = request.filter || 'all';

    let notes: NoteProps[];
    let total: number;

    switch (filter) {
      case 'favorites':
        notes = await this.noteRepository.findFavorites(workspaceId);
        total = notes.length;
        break;
      case 'pinned':
        notes = await this.noteRepository.findPinned(workspaceId);
        total = notes.length;
        break;
      case 'archived':
        notes = await this.noteRepository.findArchived(workspaceId);
        total = notes.length;
        break;
      case 'trash':
        notes = await this.noteRepository.findDeleted(workspaceId);
        total = notes.length;
        break;
      default:
        notes = await this.noteRepository.findAll({
          workspaceId: workspaceId,
          notebookId: request.notebookId,
          isDeleted: false,
          limit: request.limit,
          offset: request.offset,
          orderBy: request.orderBy,
          orderDirection: request.orderDirection,
        });
        total = await this.noteRepository.count({
          workspaceId: workspaceId,
          notebookId: request.notebookId,
          isDeleted: false,
        });
    }

    return { notes, total };
  }
}
