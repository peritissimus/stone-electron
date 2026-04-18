import {
  type NoteProps,
  type INoteRepository,
  type ISearchNotesUseCase,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class SearchNotesUseCase implements ISearchNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const workspaceId = request.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const notes = await this.noteRepository.searchByTitle({
      query: request.query,
      workspaceId,
      limit: request.limit,
    });

    return { notes, total: notes.length };
  }
}
