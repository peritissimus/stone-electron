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
  type INotebookUseCases,
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
  type IWorkspaceUseCases,
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
  type ITagUseCases,
} from './TagUseCases';

// Search Use Cases
export {
  FullTextSearchUseCase,
  SemanticSearchUseCase,
  FindSimilarNotesUseCase,
  RebuildSearchIndexUseCase,
  createSearchUseCases,
  type ISearchUseCases,
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
export { createGitUseCases, type GitUseCasesDeps } from './GitUseCases';

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
