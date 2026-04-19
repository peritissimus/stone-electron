import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../../domain/ports/out/IVersionRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IRestoreVersionUseCase } from '../../../domain/ports/in/IVersionUseCases';
import { NoteEntity } from '../../../domain/entities/Note';
import { VersionDiffer } from '../../../domain/services/VersionDiffer';
import { logger } from '../../../shared/utils';

/**
 * Restore a note to a specific version
 */
export class RestoreVersionUseCase implements IRestoreVersionUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly versionRepository: IVersionRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(noteId: string, versionId: string): Promise<void> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const version = await this.versionRepository.findById(versionId);
    if (!version || !VersionDiffer.belongsToNote(version, noteId)) {
      throw new Error(`Version not found: ${versionId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file path');
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    // Write version content to file
    const absolutePath = path.join(workspace.folderPath, note.filePath);
    await this.fileStorage.write(absolutePath, version.content);

    // Update note - reconstruct entity from props
    const noteEntity = NoteEntity.fromPersistence(note);
    noteEntity.updateTitle(version.title);
    await this.noteRepository.save(noteEntity);

    logger.info(`[VersionUseCases] Restored note ${noteId} to version ${version.versionNumber}`);
  }
}
