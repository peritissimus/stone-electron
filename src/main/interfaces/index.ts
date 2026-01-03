/**
 * Service and Repository Interfaces
 *
 * These interfaces define the contracts for the backend services.
 * Any implementation (TypeScript, Rust, Swift, Go) can implement these.
 */

// =============================================================================
// Core Entity Types
// =============================================================================

export interface Note {
  id: string;
  title: string;
  filePath: string | null;
  workspaceId: string | null;
  notebookId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  workspaceId: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  noteId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

// =============================================================================
// Service Interfaces
// =============================================================================

export interface INoteService {
  // Content
  getContent(noteId: string): Promise<string | null>;
  getRawContent(noteId: string): Promise<string | null>;

  // CRUD
  createNote(data: CreateNoteRequest): Promise<Note>;
  updateNote(id: string, data: UpdateNoteRequest, silent?: boolean): Promise<Note>;
  deleteNote(id: string, permanent?: boolean): Promise<void>;
  moveNote(id: string, folderPath: string): Promise<Note>;

  // Queries
  findById(id: string): Promise<Note | null>;
  findAll(options?: FindNotesOptions): Promise<Note[]>;
  findByFolder(folderPath: string): Promise<Note[]>;
  getFavorites(): Promise<Note[]>;
  getRecent(limit?: number): Promise<Note[]>;
  getDeleted(): Promise<Note[]>;

  // Operations
  restoreNote(id: string): Promise<Note>;
  duplicateNote(id: string): Promise<Note>;
}

export interface INotebookService {
  createNotebook(data: CreateNotebookRequest): Promise<NotebookWithCount>;
  updateNotebook(id: string, data: UpdateNotebookRequest): Promise<Notebook>;
  deleteNotebook(id: string, deleteNotes?: boolean): Promise<void>;
  moveNotebook(id: string, parentId: string | null, position?: number): Promise<Notebook>;

  getAllFlat(includeCounts?: boolean): Promise<NotebookWithCount[]>;
  getTree(): Promise<NotebookTreeNode[]>;
  getNoteCount(notebookId: string): Promise<number>;
}

export interface ITagService {
  createTag(data: CreateTagRequest): Promise<TagWithCount>;
  deleteTag(id: string): Promise<{ affectedNotes: number }>;

  getAllTags(sort?: TagSortOrder): Promise<TagWithCount[]>;
  findById(id: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;

  addTagsToNote(noteId: string, tagIds: string[]): Promise<Tag[]>;
  removeTagFromNote(noteId: string, tagId: string): Promise<void>;
  getTagsForNote(noteId: string): Promise<Tag[]>;
  setTagsForNote(noteId: string, tagNames: string[]): Promise<void>;
}

export interface IWorkspaceService {
  createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace>;
  updateWorkspace(id: string, data: UpdateWorkspaceRequest): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<void>;

  getAllWorkspaces(): Promise<Workspace[]>;
  getActiveWorkspace(): Promise<Workspace | null>;
  setActiveWorkspace(id: string): Promise<Workspace>;

  syncWorkspace(id: string): Promise<SyncResult>;
  scanWorkspace(id: string): Promise<ScanResult>;

  createFolder(workspaceId: string, folderPath: string): Promise<FolderOperationResult>;
  renameFolder(workspaceId: string, oldPath: string, newPath: string): Promise<FolderOperationResult>;
  deleteFolder(workspaceId: string, folderPath: string): Promise<void>;
}

export interface ISearchService {
  searchFullText(query: string, limit?: number): Promise<SearchResult[]>;
  searchByTitle(query: string, limit?: number): Promise<Note[]>;
  semanticSearch(query: string, limit?: number): Promise<SemanticSearchResult[]>;
  findSimilarNotes(noteId: string, limit?: number): Promise<SemanticSearchResult[]>;
}

export interface IAttachmentService {
  createAttachment(noteId: string, file: AttachmentInput): Promise<Attachment>;
  deleteAttachment(id: string): Promise<void>;
  getAttachmentsForNote(noteId: string): Promise<Attachment[]>;
  getAttachmentPath(id: string): Promise<string | null>;
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface CreateNoteRequest {
  title?: string;
  folderPath?: string;
  notebookId?: string;
  content?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  folderPath?: string;
  notebookId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
}

export interface FindNotesOptions {
  where?: Partial<Note>;
  sort?: { field: keyof Note; order: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

export interface CreateNotebookRequest {
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  position?: number;
}

export interface UpdateNotebookRequest {
  name?: string;
  icon?: string;
  color?: string;
  position?: number;
}

export interface NotebookWithCount extends Notebook {
  note_count: number;
}

export interface NotebookTreeNode extends Notebook {
  children?: NotebookTreeNode[];
  note_count?: number;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface TagWithCount extends Tag {
  note_count: number;
}

export type TagSortOrder = 'name' | 'count' | 'recent';

export interface CreateWorkspaceRequest {
  name: string;
  folderPath: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
}

export interface FolderOperationResult {
  folderPath: string;
}

export interface ScanResult {
  files: Array<{ relativePath: string; path: string }>;
  structure: unknown;
  total: number;
  counts: Record<string, number>;
}

export interface SyncResult {
  workspaceId: string;
  notebooks: { created: number; updated: number; errors: string[] };
  notes: { created: number; updated: number; deleted: number; errors: string[] };
  durationMs: number;
}

export interface SearchResult {
  note: Note;
  matchType: 'title' | 'content' | 'both';
}

export interface SemanticSearchResult {
  noteId: string;
  title: string;
  distance: number;
}

export interface AttachmentInput {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

// =============================================================================
// Event Bus Interface
// =============================================================================

export interface IEventBus {
  emit(event: string, data?: unknown): void;
  on(event: string, listener: (data: unknown) => void): void;
  off(event: string, listener: (data: unknown) => void): void;
}

// =============================================================================
// Database Interface
// =============================================================================

export interface IDatabase {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getStatus(): Promise<DatabaseStatus>;
  optimize(): Promise<void>;
  checkIntegrity(): Promise<{ ok: boolean; errors: string[] }>;
}

export interface DatabaseStatus {
  databaseSize: number;
  noteCount: number;
  notebookCount: number;
  tagCount: number;
}
