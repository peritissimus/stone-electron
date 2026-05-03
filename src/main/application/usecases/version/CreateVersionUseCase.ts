import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../../domain/ports/out/IVersionRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type {
  ICreateVersionUseCase,
  VersionSnapshot,
} from '../../../domain/ports/in/IVersionUseCases';
import { VersionEntity } from '../../../domain/entities/Version';
import { VersionDiffer } from '../../../domain/services/VersionDiffer';

/**
 * Create a new version snapshot
 */
export class CreateVersionUseCase implements ICreateVersionUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly versionRepository: IVersionRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(noteId: string): Promise<VersionSnapshot> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file path');
    }

    // Get current content
    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = this.pathService.join(workspace.folderPath, note.filePath);
    const content = await this.fileStorage.read(absolutePath);

    // Get next version number
    const nextVersionNumber = await this.versionRepository.getNextVersionNumber(noteId);

    // Create version entity
    const version = VersionEntity.create({
      id: VersionDiffer.buildVersionId(noteId, nextVersionNumber),
      noteId,
      versionNumber: nextVersionNumber,
      content: content || '',
      title: note.title || 'Untitled',
    });

    await this.versionRepository.save(version);

    return VersionDiffer.toSnapshot(version);
  }
}
