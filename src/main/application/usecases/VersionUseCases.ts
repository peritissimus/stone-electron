/**
 * Version Use Cases - Note version history management
 */

import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../domain/ports/out/IVersionRepository';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type {
  IVersionUseCases,
  IGetVersionsUseCase,
  ICreateVersionUseCase,
  IRestoreVersionUseCase,
  IGetVersionUseCase,
  VersionSnapshot,
} from '../../domain/ports/in/IVersionUseCases';
import { VersionEntity } from '../../domain/entities/Version';
import { NoteEntity } from '../../domain/entities/Note';
import { logger } from '../../shared/utils';
import path from 'node:path';

export interface VersionUseCasesDeps {
  noteRepository: INoteRepository;
  versionRepository: IVersionRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

/**
 * Get version history for a note
 */
class GetVersionsUseCase implements IGetVersionsUseCase {
  constructor(private deps: VersionUseCasesDeps) {}

  async execute(noteId: string): Promise<VersionSnapshot[]> {
    const { noteRepository, versionRepository } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const versions = await versionRepository.findByNoteId(noteId);

    return versions.map((v) => ({
      id: v.id,
      noteId: v.noteId,
      versionNumber: v.versionNumber,
      content: v.content,
      title: v.title,
      createdAt: v.createdAt,
    }));
  }
}

/**
 * Create a new version snapshot
 */
class CreateVersionUseCase implements ICreateVersionUseCase {
  constructor(private deps: VersionUseCasesDeps) {}

  async execute(noteId: string): Promise<VersionSnapshot> {
    const { noteRepository, versionRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file path');
    }

    // Get current content
    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const content = await fileStorage.read(absolutePath);

    // Get next version number
    const nextVersionNumber = await versionRepository.getNextVersionNumber(noteId);

    // Create version entity
    const version = VersionEntity.create({
      id: `${noteId}-v${nextVersionNumber}`,
      noteId,
      versionNumber: nextVersionNumber,
      content: content || '',
      title: note.title || 'Untitled',
    });

    await versionRepository.save(version);

    logger.info(`[VersionUseCases] Created version ${nextVersionNumber} for note ${noteId}`);

    return {
      id: version.id,
      noteId: version.noteId,
      versionNumber: version.versionNumber,
      content: version.content,
      title: version.title,
      createdAt: version.createdAt,
    };
  }
}

/**
 * Restore a note to a specific version
 */
class RestoreVersionUseCase implements IRestoreVersionUseCase {
  constructor(private deps: VersionUseCasesDeps) {}

  async execute(noteId: string, versionId: string): Promise<void> {
    const { noteRepository, versionRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const version = await versionRepository.findById(versionId);
    if (!version || version.noteId !== noteId) {
      throw new Error(`Version not found: ${versionId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file path');
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    // Write version content to file
    const absolutePath = path.join(workspace.folderPath, note.filePath);
    await fileStorage.write(absolutePath, version.content);

    // Update note - reconstruct entity from props
    const noteEntity = NoteEntity.fromPersistence(note);
    noteEntity.updateTitle(version.title);
    await noteRepository.save(noteEntity);

    logger.info(`[VersionUseCases] Restored note ${noteId} to version ${version.versionNumber}`);
  }
}

/**
 * Get a specific version
 */
class GetVersionUseCase implements IGetVersionUseCase {
  constructor(private deps: VersionUseCasesDeps) {}

  async execute(versionId: string): Promise<VersionSnapshot | null> {
    const version = await this.deps.versionRepository.findById(versionId);
    if (!version) return null;

    return {
      id: version.id,
      noteId: version.noteId,
      versionNumber: version.versionNumber,
      content: version.content,
      title: version.title,
      createdAt: version.createdAt,
    };
  }
}

export function createVersionUseCases(deps: VersionUseCasesDeps): IVersionUseCases {
  return {
    getVersions: new GetVersionsUseCase(deps),
    createVersion: new CreateVersionUseCase(deps),
    restoreVersion: new RestoreVersionUseCase(deps),
    getVersion: new GetVersionUseCase(deps),
  };
}
