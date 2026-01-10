/**
 * API Contracts - Method signatures for data operations
 *
 * Defines the interface between UI and backend.
 * Implementation can be:
 * - Electron IPC
 * - REST API
 * - GraphQL
 * - Local SQLite
 * - Core Data / Room
 */

import type {
  UUID,
  FilePath,
  Note,
  NoteWithRelations,
  Notebook,
  NotebookWithCount,
  Tag,
  TagWithCount,
  Topic,
  TopicWithCount,
  Workspace,
  Attachment,
  NoteVersion,
  TodoItem,
  SearchResult,
  GraphData,
  FileTreeNode,
} from './entities';

// =============================================================================
// RESULT TYPE
// =============================================================================

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// =============================================================================
// NOTE API
// =============================================================================

export interface NoteFilters {
  notebookId?: UUID;
  folderPath?: FilePath;
  tagIds?: UUID[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  includeArchived?: boolean;
  includeTags?: boolean;
  includeTopics?: boolean;
}

export interface NoteAPI {
  // CRUD
  getAll(filters?: NoteFilters): Promise<Result<NoteWithRelations[]>>;
  getById(id: UUID): Promise<Result<Note>>;
  getByPath(path: FilePath): Promise<Result<Note>>;
  getContent(id: UUID): Promise<Result<string>>;
  create(data: { title: string; content?: string; folderPath?: FilePath }): Promise<Result<Note>>;
  update(
    id: UUID,
    data: { title?: string; content?: string },
    silent?: boolean,
  ): Promise<Result<Note>>;
  delete(id: UUID): Promise<Result<void>>;
  move(id: UUID, targetPath: FilePath): Promise<Result<Note>>;

  // Flags
  setFavorite(id: UUID, favorite: boolean): Promise<Result<Note>>;
  setPinned(id: UUID, pinned: boolean): Promise<Result<Note>>;
  setArchived(id: UUID, archived: boolean): Promise<Result<Note>>;

  // Versions
  getVersions(id: UUID): Promise<Result<NoteVersion[]>>;
  restoreVersion(id: UUID, versionId: UUID): Promise<Result<Note>>;

  // Links
  getBacklinks(id: UUID): Promise<Result<Note[]>>;
  getForwardLinks(id: UUID): Promise<Result<Note[]>>;
  getGraphData(): Promise<Result<GraphData>>;

  // Todos
  getAllTodos(): Promise<Result<TodoItem[]>>;
  updateTaskState(noteId: UUID, taskIndex: number, newState: string): Promise<Result<void>>;

  // Export
  exportHtml(id: UUID): Promise<Result<{ html: string; path: FilePath }>>;
  exportPdf(id: UUID): Promise<Result<{ path: FilePath }>>;
  exportMarkdown(id: UUID): Promise<Result<{ markdown: string; path: FilePath }>>;
}

// =============================================================================
// NOTEBOOK API
// =============================================================================

export interface NotebookFilters {
  parentId?: UUID | null;
  workspaceId?: UUID;
}

export interface NotebookAPI {
  getAll(filters?: NotebookFilters): Promise<Result<NotebookWithCount[]>>;
  getById(id: UUID): Promise<Result<Notebook>>;
  create(data: { name: string; parentId?: UUID; path?: FilePath }): Promise<Result<Notebook>>;
  update(
    id: UUID,
    data: { name?: string; icon?: string; color?: string },
  ): Promise<Result<Notebook>>;
  delete(id: UUID): Promise<Result<void>>;
  move(id: UUID, newParentId: UUID | null): Promise<Result<Notebook>>;
}

// =============================================================================
// TAG API
// =============================================================================

export interface TagAPI {
  getAll(): Promise<Result<TagWithCount[]>>;
  getById(id: UUID): Promise<Result<Tag>>;
  create(data: { name: string; color?: string }): Promise<Result<Tag>>;
  update(id: UUID, data: { name?: string; color?: string }): Promise<Result<Tag>>;
  delete(id: UUID): Promise<Result<void>>;

  // Note associations
  addToNote(tagId: UUID, noteId: UUID): Promise<Result<void>>;
  removeFromNote(tagId: UUID, noteId: UUID): Promise<Result<void>>;
  getNoteTags(noteId: UUID): Promise<Result<Tag[]>>;
}

// =============================================================================
// TOPIC API
// =============================================================================

export interface TopicAPI {
  getAll(): Promise<Result<TopicWithCount[]>>;
  getById(id: UUID): Promise<Result<Topic>>;
  create(data: { name: string; color?: string; description?: string }): Promise<Result<Topic>>;
  update(
    id: UUID,
    data: { name?: string; color?: string; description?: string },
  ): Promise<Result<Topic>>;
  delete(id: UUID): Promise<Result<void>>;

  // Note associations
  addToNote(topicId: UUID, noteId: UUID, confidence?: number): Promise<Result<void>>;
  removeFromNote(topicId: UUID, noteId: UUID): Promise<Result<void>>;
  getNoteTopics(noteId: UUID): Promise<Result<Array<Topic & { confidence: number }>>>;

  // Classification
  classifyNote(noteId: UUID): Promise<Result<Array<{ topicId: UUID; confidence: number }>>>;
}

// =============================================================================
// WORKSPACE API
// =============================================================================

export interface WorkspaceAPI {
  getAll(): Promise<Result<Workspace[]>>;
  getActive(): Promise<Result<Workspace>>;
  create(data: { name: string; path: FilePath }): Promise<Result<Workspace>>;
  setActive(id: UUID): Promise<Result<void>>;
  sync(id?: UUID): Promise<Result<void>>;
  getFileTree(id?: UUID): Promise<Result<FileTreeNode[]>>;
}

// =============================================================================
// ATTACHMENT API
// =============================================================================

export interface AttachmentAPI {
  getByNote(noteId: UUID): Promise<Result<Attachment[]>>;
  upload(noteId: UUID, file: File | { path: FilePath; name: string }): Promise<Result<Attachment>>;
  delete(id: UUID): Promise<Result<void>>;
  getPath(id: UUID): Promise<Result<FilePath>>;
}

// =============================================================================
// SEARCH API
// =============================================================================

export interface SearchParams {
  query: string;
  type?: 'fts' | 'semantic' | 'hybrid';
  limit?: number;
  notebookId?: UUID;
  tagIds?: UUID[];
}

export interface SearchAPI {
  search(params: SearchParams): Promise<Result<SearchResult[]>>;
  searchByDate(params: { start: Date; end: Date }): Promise<Result<Note[]>>;
  getRecent(limit?: number): Promise<Result<Note[]>>;
}

// =============================================================================
// SETTINGS API
// =============================================================================

export interface SettingsAPI {
  get<T>(key: string): Promise<Result<T>>;
  set<T>(key: string, value: T): Promise<Result<void>>;
  getAll(): Promise<Result<Record<string, unknown>>>;
}

// =============================================================================
// DATABASE API
// =============================================================================

export interface DatabaseStatus {
  version: number;
  noteCount: number;
  notebookCount: number;
  tagCount: number;
  databaseSize: number;
  integrityOk: boolean;
}

export interface DatabaseAPI {
  getStatus(): Promise<Result<DatabaseStatus>>;
  backup(): Promise<Result<{ path: FilePath; size: number }>>;
  vacuum(): Promise<Result<{ freedBytes: number }>>;
  checkIntegrity(): Promise<Result<{ ok: boolean; errors: string[] }>>;
}

// =============================================================================
// SYSTEM API
// =============================================================================

export interface SystemAPI {
  getAppVersion(): Promise<Result<string>>;
  getDataPath(): Promise<Result<FilePath>>;
  openExternal(url: string): Promise<Result<void>>;
  showInFinder(path: FilePath): Promise<Result<void>>;
  pickFolder(): Promise<Result<FilePath | null>>;
}

// =============================================================================
// COMBINED API (convenience interface)
// =============================================================================

export interface API {
  note: NoteAPI;
  notebook: NotebookAPI;
  tag: TagAPI;
  topic: TopicAPI;
  workspace: WorkspaceAPI;
  attachment: AttachmentAPI;
  search: SearchAPI;
  settings: SettingsAPI;
  database: DatabaseAPI;
  system: SystemAPI;
}
