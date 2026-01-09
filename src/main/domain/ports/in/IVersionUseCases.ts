/**
 * Version Use Case Ports - Inbound interfaces for version history operations
 */

/**
 * Version snapshot
 */
export interface VersionSnapshot {
  id: string;
  noteId: string;
  versionNumber: number;
  content: string;
  title: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Get version history for a note
 */
export interface IGetVersionsUseCase {
  execute(noteId: string): Promise<VersionSnapshot[]>;
}

/**
 * Create a new version snapshot
 */
export interface ICreateVersionUseCase {
  execute(noteId: string): Promise<VersionSnapshot>;
}

/**
 * Restore a note to a specific version
 */
export interface IRestoreVersionUseCase {
  execute(noteId: string, versionId: string): Promise<void>;
}

/**
 * Get a specific version
 */
export interface IGetVersionUseCase {
  execute(versionId: string): Promise<VersionSnapshot | null>;
}

/**
 * Aggregated version use cases
 */
export interface IVersionUseCases {
  getVersions: IGetVersionsUseCase;
  createVersion: ICreateVersionUseCase;
  restoreVersion: IRestoreVersionUseCase;
  getVersion: IGetVersionUseCase;
}
