/**
 * Persistence Adapters Index
 *
 * SQLite repository implementations.
 */

export { NoteRepository, type NoteRepositoryDeps } from './NoteRepository';
export { NotebookRepository, type NotebookRepositoryDeps } from './NotebookRepository';
export { WorkspaceRepository, type WorkspaceRepositoryDeps } from './WorkspaceRepository';
export { TagRepository, type TagRepositoryDeps } from './TagRepository';
export { TopicRepository } from './TopicRepository';
export { AttachmentRepository } from './AttachmentRepository';
export { VersionRepository } from './VersionRepository';
export { NoteLinkRepository } from './NoteLinkRepository';
export { SettingsRepository, type SettingsRepositoryDeps } from './SettingsRepository';
export { AppConfigRepository, type AppConfigRepositoryDeps } from './AppConfigRepository';
export {
  SecureAIProviderKeyStore,
  type SecureAIProviderKeyStoreDeps,
} from './SecureAIProviderKeyStore';
export { JournalReader, type JournalReaderDeps } from './JournalReader';
export { IndexRepository, type IndexRepositoryDeps } from './IndexRepository';
export {
  MeetingRecordingRepository,
  type MeetingRecordingRepositoryDeps,
} from './MeetingRecordingRepository';
export {
  FileSystemTemplateRepository,
  type FileSystemTemplateRepositoryDeps,
} from './FileSystemTemplateRepository';
export { JobRepository, type JobRepositoryDeps } from './JobRepository';
