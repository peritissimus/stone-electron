/**
 * Version Use Case Ports - Inbound interfaces for version history operations
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

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
  execute(noteId: string): Effect.Effect<VersionSnapshot[], Error>;
}

/**
 * Create a new version snapshot
 */
export interface ICreateVersionUseCase {
  execute(noteId: string): Effect.Effect<VersionSnapshot, Error>;
}

/**
 * Restore a note to a specific version
 */
export interface IRestoreVersionUseCase {
  execute(noteId: string, versionId: string): Effect.Effect<void, Error>;
}

/**
 * Get a specific version
 */
export interface IGetVersionUseCase {
  execute(versionId: string): Effect.Effect<VersionSnapshot | null, Error>;
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

export const VersionUseCasesPort =
  Context.GenericTag<IVersionUseCases>('stone/IVersionUseCases');
