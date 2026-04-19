/**
 * Application Use Cases Index
 *
 * Export all use case implementations and factories.
 * All use cases are organized flat at this level for consistency.
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
  GetNoteByPathUseCase,
  ToggleFavoriteUseCase,
  TogglePinUseCase,
  ToggleArchiveUseCase,
  createNoteUseCases,
  type NoteUseCasesDeps,
} from './note';

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
  UpdateWorkspaceUseCase,
  SelectFolderUseCase,
  ValidatePathUseCase,
  CreateFolderUseCase,
  RenameFolderUseCase,
  DeleteFolderUseCase,
  MoveFolderUseCase,
  ScanWorkspaceUseCase,
  SyncWorkspaceUseCase,
  createWorkspaceUseCases,
  type WorkspaceUseCasesDeps,
} from './workspace';

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
export { createTaskUseCases, type TaskUseCasesDeps } from './TaskUseCases';

// Graph Use Cases
export { createGraphUseCases, type GraphUseCasesDeps } from './GraphUseCases';

// Version Use Cases
export { createVersionUseCases, type VersionUseCasesDeps } from './VersionUseCases';

// Topic Use Cases
export { createTopicUseCases, type TopicUseCasesDeps } from './TopicUseCases';

// Attachment Use Cases
export { createAttachmentUseCases, type AttachmentUseCasesDeps } from './AttachmentUseCases';

// Git Use Cases
export {
  GetGitStatusUseCase,
  InitGitRepoUseCase,
  GitCommitUseCase,
  GitPullUseCase,
  GitPushUseCase,
  GitSyncUseCase,
  SetGitRemoteUseCase,
  GetGitCommitsUseCase,
  createGitUseCases,
  type GitUseCasesDeps,
} from './git';

// Database Use Cases
export { createDatabaseUseCases, type DatabaseUseCasesDeps } from './DatabaseUseCases';

// Quick Capture Use Cases
export { createQuickCaptureUseCases, type QuickCaptureUseCasesDeps } from './QuickCaptureUseCases';

// Export Use Cases
export { createExportUseCases, type ExportUseCasesDeps } from './ExportUseCases';

// System Use Cases
export { createSystemUseCases, type SystemUseCasesDeps } from './SystemUseCases';

// Settings Use Cases
export { createSettingsUseCases, type SettingsUseCasesDeps } from './SettingsUseCases';
