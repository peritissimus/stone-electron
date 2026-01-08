/**
 * Application Use Cases Index
 *
 * Export all use case implementations and factories.
 */

// Note Use Cases
export {
  CreateNoteUseCase,
  UpdateNoteUseCase,
  GetNoteUseCase,
  ListNotesUseCase,
  DeleteNoteUseCase,
  RestoreNoteUseCase,
  MoveNoteUseCase,
  SearchNotesUseCase,
  GetNoteContentUseCase,
  SaveNoteContentUseCase,
  createNoteUseCases,
} from './NoteUseCases';

// Notebook Use Cases
export {
  CreateNotebookUseCase,
  UpdateNotebookUseCase,
  GetNotebookUseCase,
  ListNotebooksUseCase,
  DeleteNotebookUseCase,
  MoveNotebookUseCase,
  createNotebookUseCases,
} from './NotebookUseCases';

// Workspace Use Cases
export {
  CreateWorkspaceUseCase,
  GetWorkspaceUseCase,
  ListWorkspacesUseCase,
  SetActiveWorkspaceUseCase,
  GetActiveWorkspaceUseCase,
  DeleteWorkspaceUseCase,
  createWorkspaceUseCases,
} from './WorkspaceUseCases';

// Tag Use Cases
export {
  CreateTagUseCase,
  UpdateTagUseCase,
  GetTagUseCase,
  ListTagsUseCase,
  DeleteTagUseCase,
  AddTagToNoteUseCase,
  RemoveTagFromNoteUseCase,
  GetNoteTagsUseCase,
  createTagUseCases,
} from './TagUseCases';

// Search Use Cases
export {
  FullTextSearchUseCase,
  SemanticSearchUseCase,
  FindSimilarNotesUseCase,
  RebuildSearchIndexUseCase,
  createSearchUseCases,
} from './SearchUseCases';

// Task Use Cases
export { createTaskUseCases } from './task';
export type { TaskUseCasesDeps } from './task';

// Graph Use Cases
export { createGraphUseCases } from './graph';
export type { GraphUseCasesDeps } from './graph';

// Version Use Cases
export { createVersionUseCases } from './version';
export type { VersionUseCasesDeps } from './version';

// Topic Use Cases
export { createTopicUseCases } from './topic';
export type { TopicUseCasesDeps } from './topic';

// Attachment Use Cases
export { createAttachmentUseCases } from './attachment';
export type { AttachmentUseCasesDeps } from './attachment';

// Git Use Cases
export { createGitUseCases } from './git';
export type { GitUseCasesDeps } from './git';

// Database Use Cases
export { createDatabaseUseCases } from './database';
export type { DatabaseUseCasesDeps } from './database';

// Quick Capture Use Cases
export { createQuickCaptureUseCases } from './quickcapture';
export type { QuickCaptureUseCasesDeps } from './quickcapture';

// Export Use Cases
export { createExportUseCases } from './export';
export type { ExportUseCasesDeps } from './export';

// System Use Cases
export { createSystemUseCases } from './system';
export type { SystemUseCasesDeps } from './system';
