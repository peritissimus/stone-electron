import path from 'node:path';
import {
  type NoteProps,
  type INoteRepository,
  type IFileStorage,
  type IGetNoteUseCase,
  NoteNotFoundError,
} from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class GetNoteUseCase implements IGetNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: {
    id: string;
    includeContent?: boolean;
  }): Promise<{ note: NoteProps; content?: string }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    let content: string | undefined;
    if (request.includeContent && noteProps.filePath) {
      const workspaceId =
        noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
      const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

      if (workspace) {
        const absolutePath = path.join(workspace.folderPath, noteProps.filePath);
        const exists = await this.fileStorage.exists(absolutePath);
        if (exists) {
          const markdown = await this.fileStorage.read(absolutePath);
          if (markdown) {
            content = markdown;
          }
        }
      }
    }

    return { note: noteProps, content };
  }
}
