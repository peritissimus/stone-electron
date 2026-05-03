import {
  type INoteRepository,
  type IFileStorage,
  type IGetNoteContentUseCase,
  type IPathService,
  NoteNotFoundError,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import { stripFirstHeading } from '../../../domain/services';

export class GetNoteContentUseCase implements IGetNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: { id: string }): Promise<{ content: string }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      return { content: '' };
    }

    const workspaceId = noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

    if (!workspace) {
      return { content: '' };
    }

    const absolutePath = this.pathService.join(workspace.folderPath, noteProps.filePath);
    const exists = await this.fileStorage.exists(absolutePath);
    if (!exists) {
      return { content: '' };
    }

    const markdown = await this.fileStorage.read(absolutePath);
    if (!markdown) {
      return { content: '' };
    }

    return { content: stripFirstHeading(markdown) };
  }
}
