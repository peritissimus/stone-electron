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
