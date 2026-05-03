import {
  type INoteRepository,
  type IFileStorage,
  type ISaveNoteContentUseCase,
  type IPathService,
  NoteNotFoundError,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class SaveNoteContentUseCase implements ISaveNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: { id: string; content: string }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      throw new Error('Note has no file path');
    }

    const workspaceId = noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

    if (!workspace) {
      throw new Error('Workspace not found for note');
    }

    const absolutePath = this.pathService.join(workspace.folderPath, noteProps.filePath);
    const bodyMarkdown = request.content;
    const titleHeading = `# ${noteProps.title}\n\n`;
    const fullMarkdown = titleHeading + bodyMarkdown;

    await this.fileStorage.write(absolutePath, fullMarkdown);
  }
}
