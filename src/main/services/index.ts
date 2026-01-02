/**
 * Services Module Exports
 *
 * Central export point for all service singletons.
 * Services contain business logic and orchestrate repositories.
 *
 * Pattern: IPC Handlers → Services → Repositories → Database
 */

// Infrastructure Services
export { getEventBus, EventBus } from './EventBus';
export { getFileSystemService, FileSystemService } from './FileSystemService';
export { getFileWatcherService, FileWatcherService } from './FileWatcherService';
export { getMarkdownService, MarkdownService } from './MarkdownService';

// Domain Services - Workspace
export { getWorkspaceService } from './WorkspaceService';
export type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  FolderOperationResult,
  ScanResult,
} from './WorkspaceService';

// Domain Services - Notebooks
export { getNotebookService } from './NotebookService';
export type {
  CreateNotebookRequest,
  UpdateNotebookRequest,
  NotebookWithCount,
  NotebookTreeNode,
} from './NotebookService';

// Domain Services - Notes
export { getNoteService } from './NoteService';
export type { CreateNoteRequest, UpdateNoteRequest, NoteWithRelations } from './NoteService';

export { getGraphService } from './GraphService';
export type { BacklinkInfo, LinkInfo, GraphNode, GraphLink, GraphData } from './GraphService';

export { getSearchService } from './SearchService';
export type { SearchResult, SemanticSearchResult } from './SearchService';

export { getTaskService } from './TaskService';
export type { TodoItem, TaskState } from './TaskService';

export { getExportService } from './ExportService';
export type { ExportResult } from './ExportService';

export { getSyncService } from './SyncService';
export type { SyncResult } from './SyncService';

// Domain Services - Tags
export { getTagService } from './TagService';
export type { CreateTagRequest, TagWithCount, TagSortOrder } from './TagService';

// Domain Services - Attachments
export { getAttachmentService } from './AttachmentService';
export type { AddAttachmentRequest, UploadImageRequest, UploadImageResult } from './AttachmentService';

// AI/ML Services
export { getEmbeddingService, EmbeddingService } from './EmbeddingService';
export { getTopicService, TopicService } from './TopicService';
