/**
 * Application DTOs Index
 *
 * Export all Data Transfer Objects.
 */

// Note DTOs
export type {
  CreateNoteDTO,
  UpdateNoteDTO,
  GetNoteDTO,
  ListNotesDTO,
  DeleteNoteDTO,
  RestoreNoteDTO,
  MoveNoteDTO,
  SearchNotesDTO,
  GetNoteContentDTO,
  SaveNoteContentDTO,
  NoteResponseDTO,
  NoteWithContentResponseDTO,
  NoteListResponseDTO,
  NoteContentResponseDTO,
} from './NoteDTO';

// Notebook DTOs
export type {
  CreateNotebookDTO,
  UpdateNotebookDTO,
  GetNotebookDTO,
  ListNotebooksDTO,
  DeleteNotebookDTO,
  MoveNotebookDTO,
  NotebookResponseDTO,
  NotebookListResponseDTO,
  NotebookTreeNode,
  NotebookTreeResponseDTO,
} from './NotebookDTO';

// Workspace DTOs
export type {
  CreateWorkspaceDTO,
  UpdateWorkspaceDTO,
  GetWorkspaceDTO,
  SetActiveWorkspaceDTO,
  SyncWorkspaceDTO,
  WorkspaceResponseDTO,
  WorkspaceListResponseDTO,
  WorkspaceSyncResultDTO,
} from './WorkspaceDTO';

// Tag DTOs
export type {
  CreateTagDTO,
  UpdateTagDTO,
  GetTagDTO,
  DeleteTagDTO,
  AddTagToNoteDTO,
  RemoveTagFromNoteDTO,
  GetNoteTagsDTO,
  TagResponseDTO,
  TagListResponseDTO,
  TagWithCountDTO,
} from './TagDTO';

// Search DTOs
export type {
  SearchQueryDTO,
  SemanticSearchDTO,
  SimilarNotesDTO,
  SearchResultDTO,
  SearchResponseDTO,
  SemanticSearchResultDTO,
  SemanticSearchResponseDTO,
} from './SearchDTO';

// Task DTOs
export type {
  TaskDTO,
  GetAllTasksResponseDTO,
  GetNoteTasksRequestDTO,
  UpdateTaskStateRequestDTO,
  ToggleTaskRequestDTO,
} from './TaskDTO';

// Topic DTOs
export type {
  TopicDTO,
  CreateTopicRequestDTO,
  UpdateTopicRequestDTO,
  ClassifyNoteRequestDTO,
  ClassifyNoteResponseDTO,
  ClassifyAllRequestDTO,
  ClassifyAllResponseDTO,
  SimilarNotesRequestDTO,
  SimilarNoteDTO,
  SemanticSearchRequestDTO,
  AssignTopicRequestDTO,
  EmbeddingStatusDTO,
} from './TopicDTO';

// Attachment DTOs
export type {
  AttachmentDTO,
  AddAttachmentRequestDTO,
  AddAttachmentResponseDTO,
  DeleteAttachmentRequestDTO,
  GetAttachmentsRequestDTO,
  UploadImageRequestDTO,
  UploadImageResponseDTO,
} from './AttachmentDTO';

// Version DTOs
export type {
  VersionDTO,
  VersionDetailDTO,
  GetVersionsRequestDTO,
  GetVersionsResponseDTO,
  CreateVersionRequestDTO,
  RestoreVersionRequestDTO,
  CompareVersionsRequestDTO,
  CompareVersionsResponseDTO,
} from './VersionDTO';

// Graph DTOs
export type {
  NoteLinkDTO,
  BacklinksResponseDTO,
  ForwardLinksResponseDTO,
  GraphNodeDTO,
  GraphEdgeDTO,
  GraphDataDTO,
  GetGraphDataRequestDTO,
  UpdateNoteLinksRequestDTO,
} from './GraphDTO';

// Git DTOs
export type {
  GitFileChangeDTO,
  GitStatusDTO,
  GitCommitDTO,
  GitOperationResultDTO,
  GitInitRequestDTO,
  GitCommitRequestDTO,
  GitPullRequestDTO,
  GitPushRequestDTO,
  GitSyncRequestDTO,
  GitSetRemoteRequestDTO,
  GitGetCommitsRequestDTO,
  GitGetCommitsResponseDTO,
} from './GitDTO';
