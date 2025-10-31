/**
 * Repository Module Exports
 */

import { NoteRepository } from './NoteRepository';
import { NotebookRepository } from './NotebookRepository';
import { TagRepository } from './TagRepository';
import { VersionRepository } from './VersionRepository';
import { AttachmentRepository } from './AttachmentRepository';

export { NoteRepository } from './NoteRepository';
export { NotebookRepository } from './NotebookRepository';
export { TagRepository } from './TagRepository';
export { VersionRepository } from './VersionRepository';
export { AttachmentRepository } from './AttachmentRepository';

/**
 * Repository Collection
 */
export class Repositories {
  public note: NoteRepository;
  public notebook: NotebookRepository;
  public tag: TagRepository;
  public version: VersionRepository;
  public attachment: AttachmentRepository;

  constructor() {
    this.note = new NoteRepository();
    this.notebook = new NotebookRepository();
    this.tag = new TagRepository();
    this.version = new VersionRepository();
    this.attachment = new AttachmentRepository();
  }
}

// Singleton instance
let instance: Repositories | null = null;

/**
 * Get or create repositories instance
 */
export function getRepositories(): Repositories {
  if (!instance) {
    instance = new Repositories();
  }
  return instance;
}
