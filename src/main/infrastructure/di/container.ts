/**
 * Application DI Container
 *
 * Wires all hexagonal architecture components using dependency injection.
 * This is the composition root where all dependencies are resolved.
 */

// Shared Layer
import type { Database } from '@main/shared';

// Domain Layer - Ports
import type {
  // Outbound Ports (Repositories)
  INoteRepository,
  INotebookRepository,
  IWorkspaceRepository,
  ITagRepository,
  ITopicRepository,
  IAttachmentRepository,
  IVersionRepository,
  INoteLinkRepository,
  ISettingsRepository,
  IAppConfigRepository,
  // Outbound Ports (Services)
  IFileStorage,
  IMarkdownProcessor,
  IEventPublisher,
  ISearchEngine,
  IEmbedder,
  IExporter,
  ISystemBridge,
  IGitClient,
  // Inbound Ports (Use Cases)
  INoteUseCases,
  INotebookUseCases,
  IWorkspaceUseCases,
  ITagUseCases,
  ISearchUseCases,
  ITaskUseCases,
  IGraphUseCases,
  IVersionUseCases,
  ITopicUseCases,
  IAttachmentUseCases,
  IExportUseCases,
  IQuickCaptureUseCases,
  ISystemUseCases,
  IDatabaseUseCases,
  IGitUseCases,
  ISettingsUseCases,
  IJournalUseCases,
  IQuickNoteUseCases,
} from '@domain';

// Application Layer - Use Cases
import {
  createNoteUseCases,
  createNotebookUseCases,
  createWorkspaceUseCases,
  createTagUseCases,
  createSearchUseCases,
  createTaskUseCases,
  createGraphUseCases,
  createVersionUseCases,
  createTopicUseCases,
  createAttachmentUseCases,
  createGitUseCases,
  createDatabaseUseCases,
  createQuickCaptureUseCases,
  createExportUseCases,
  createSystemUseCases,
  createSettingsUseCases,
  createJournalUseCases,
  createQuickNoteUseCases,
} from '@application';

// Adapters Layer
import {
  // Inbound (Primary) - IPC
  NoteIPC,
  NotebookIPC,
  WorkspaceIPC,
  TagIPC,
  SearchIPC,
  registerTaskHandlers,
  unregisterTaskHandlers,
  registerTopicHandlers,
  unregisterTopicHandlers,
  registerGraphHandlers,
  unregisterGraphHandlers,
  registerVersionHandlers,
  unregisterVersionHandlers,
  registerAttachmentHandlers,
  unregisterAttachmentHandlers,
  registerExportHandlers,
  unregisterExportHandlers,
  registerGitHandlers,
  unregisterGitHandlers,
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
  registerQuickCaptureHandlers,
  unregisterQuickCaptureHandlers,
  registerJournalHandlers,
  unregisterJournalHandlers,
  registerQuickNoteHandlers,
  unregisterQuickNoteHandlers,
  registerSystemHandlers,
  unregisterSystemHandlers,
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  registerPerformanceHandlers,
  unregisterPerformanceHandlers,
  // Outbound (Secondary) - Persistence
  NoteRepository,
  NotebookRepository,
  WorkspaceRepository,
  TagRepository,
  TopicRepository,
  AttachmentRepository,
  VersionRepository,
  NoteLinkRepository,
  SettingsRepository,
  AppConfigRepository,
  // Outbound (Secondary) - Storage
  FileSystemStorage,
  // Outbound (Secondary) - Services
  MarkdownProcessor,
  SearchEngine,
  Embedder,
  Exporter,
  SystemBridge,
  GitClient,
  FileWatcher,
  getPerformanceMonitor,
  // Outbound (Secondary) - Events
  EventPublisher,
} from '@adapters';

// ============================================================================
// Container Types
// ============================================================================

export interface DatabaseManagerInterface {
  getStatus: () => Promise<{
    path: string;
    size: number;
    isOpen: boolean;
  }>;
  checkIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
  optimize: () => Promise<void>;
  getDbPath: () => string;
}

export interface ContainerDeps {
  db: Database;
  dbManager?: DatabaseManagerInterface;
}

export interface Container {
  // Ports - Repositories
  noteRepository: INoteRepository;
  notebookRepository: INotebookRepository;
  workspaceRepository: IWorkspaceRepository;
  tagRepository: ITagRepository;
  topicRepository: ITopicRepository;
  attachmentRepository: IAttachmentRepository;
  versionRepository: IVersionRepository;
  noteLinkRepository: INoteLinkRepository;
  settingsRepository: ISettingsRepository;
  appConfigRepository: IAppConfigRepository;

  // Ports - Services
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher: IEventPublisher;
  searchEngine: ISearchEngine;
  embedder: IEmbedder;
  exporter: IExporter;
  systemBridge: ISystemBridge;
  gitClient: IGitClient;
  fileWatcher: FileWatcher;

  // Use Cases - Core
  noteUseCases: INoteUseCases;
  notebookUseCases: INotebookUseCases;
  workspaceUseCases: IWorkspaceUseCases;
  tagUseCases: ITagUseCases;
  searchUseCases: ISearchUseCases;

  // Use Cases - Extended
  taskUseCases: ITaskUseCases;
  graphUseCases: IGraphUseCases;
  versionUseCases: IVersionUseCases;
  topicUseCases: ITopicUseCases;
  attachmentUseCases: IAttachmentUseCases;
  gitUseCases: IGitUseCases;
  databaseUseCases: IDatabaseUseCases;
  quickCaptureUseCases: IQuickCaptureUseCases;
  exportUseCases: IExportUseCases;
  systemUseCases: ISystemUseCases;
  settingsUseCases: ISettingsUseCases;
  journalUseCases: IJournalUseCases;
  quickNoteUseCases: IQuickNoteUseCases;

  // IPC Adapters (class-based)
  noteIPC: NoteIPC;
  notebookIPC: NotebookIPC;
  workspaceIPC: WorkspaceIPC;
  tagIPC: TagIPC;
  searchIPC: SearchIPC;

  // Helpers
  getWorkspacePath: () => string | null;
  getDatabaseManager: () => {
    getStatus: () => Promise<{ path: string; size: number; isOpen: boolean }>;
    vacuum: () => Promise<void>;
    checkIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
  };
}

// ============================================================================
// Active Workspace State
// ============================================================================

let activeWorkspacePath: string | null = null;

export function setActiveWorkspacePath(path: string | null): void {
  activeWorkspacePath = path;
}

export function getActiveWorkspacePath(): string | null {
  return activeWorkspacePath;
}

// ============================================================================
// Container Factory
// ============================================================================

export function createContainer(deps: ContainerDeps): Container {
  const { db, dbManager } = deps;

  // Helper function for workspace path
  const getWorkspacePath = () => activeWorkspacePath;

  // Database manager - use real one if provided, otherwise stub
  const getDatabaseManager = () => ({
    getStatus: async () => {
      if (dbManager) {
        return await dbManager.getStatus();
      }
      return { path: '', size: 0, isOpen: true };
    },
    vacuum: async () => {
      if (dbManager) {
        await dbManager.optimize();
      }
    },
    checkIntegrity: async () => {
      if (dbManager) {
        return await dbManager.checkIntegrity();
      }
      return { ok: true, errors: [] };
    },
  });

  // ---------------------------------------------------------------------------
  // Layer 1: Infrastructure Services (no dependencies)
  // ---------------------------------------------------------------------------
  const fileStorage: IFileStorage = new FileSystemStorage();
  const markdownProcessor: IMarkdownProcessor = new MarkdownProcessor();
  const eventPublisher: IEventPublisher = new EventPublisher();
  const exporter: IExporter = new Exporter();
  const systemBridge: ISystemBridge = new SystemBridge();
  const gitClient: IGitClient = new GitClient();

  // ---------------------------------------------------------------------------
  // Layer 2: Repositories (depend on db, some services)
  // ---------------------------------------------------------------------------
  const workspaceRepository: IWorkspaceRepository = new WorkspaceRepository({ db });
  const notebookRepository: INotebookRepository = new NotebookRepository({ db });
  const tagRepository: ITagRepository = new TagRepository({ db });
  const topicRepository: ITopicRepository = new TopicRepository({ db });
  const attachmentRepository: IAttachmentRepository = new AttachmentRepository({ db });
  const versionRepository: IVersionRepository = new VersionRepository({ db });
  const noteLinkRepository: INoteLinkRepository = new NoteLinkRepository({ db });
  const settingsRepository: ISettingsRepository = new SettingsRepository({ db });
  const appConfigRepository: IAppConfigRepository = new AppConfigRepository();

  const noteRepository: INoteRepository = new NoteRepository({
    db,
    fileStorage,
    getWorkspacePath,
  });

  const fileWatcher = new FileWatcher({
    workspaceRepository,
    noteRepository,
    notebookRepository,
    eventPublisher,
  });

  // ---------------------------------------------------------------------------
  // Layer 3: Domain Services (depend on repositories)
  // ---------------------------------------------------------------------------
  const embedder: IEmbedder = new Embedder({
    noteRepository,
    markdownProcessor,
  });

  const searchEngine: ISearchEngine = new SearchEngine({
    db,
    noteRepository,
    embedder,
  });

  // ---------------------------------------------------------------------------
  // Layer 4: Use Cases (depend on repositories and services)
  // ---------------------------------------------------------------------------
  const noteUseCases = createNoteUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
    eventPublisher,
  });

  const notebookUseCases = createNotebookUseCases({
    notebookRepository,
    eventPublisher,
  });

  const workspaceUseCases = createWorkspaceUseCases({
    workspaceRepository,
    noteRepository,
    fileStorage,
    systemBridge,
    markdownProcessor,
    appConfigRepository,
    eventPublisher,
  });

  const tagUseCases = createTagUseCases({
    tagRepository,
    eventPublisher,
  });

  const searchUseCases = createSearchUseCases({
    noteRepository,
    searchEngine,
    embedder,
  });

  // Task use cases
  const taskUseCases = createTaskUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
  });

  // Graph use cases
  const graphUseCases = createGraphUseCases({
    noteRepository,
    noteLinkRepository,
    workspaceRepository,
    fileStorage,
  });

  // Version use cases
  const versionUseCases = createVersionUseCases({
    noteRepository,
    versionRepository,
    workspaceRepository,
    fileStorage,
  });

  // Topic use cases
  const topicUseCases = createTopicUseCases({
    noteRepository,
    topicRepository,
    workspaceRepository,
    fileStorage,
    embedder,
    markdownProcessor,
    eventPublisher,
  });

  // Attachment use cases
  const attachmentUseCases = createAttachmentUseCases({
    noteRepository,
    attachmentRepository,
    workspaceRepository,
    fileStorage,
  });

  // Git use cases
  const gitUseCases = createGitUseCases({
    workspaceRepository,
    gitClient,
  });

  // Database use cases
  const databaseUseCases = createDatabaseUseCases({
    getDatabaseManager,
  });

  // Quick capture use cases
  const quickCaptureUseCases = createQuickCaptureUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
  });

  // Journal use cases
  const journalUseCases = createJournalUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    eventPublisher,
  });

  // Quick note (slot-based) use cases
  const quickNoteUseCases = createQuickNoteUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    eventPublisher,
  });

  // Export use cases
  const exportUseCases = createExportUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
    exporter,
  });

  // System use cases
  const systemUseCases = createSystemUseCases({
    systemBridge,
  });

  // Settings use cases
  const settingsUseCases = createSettingsUseCases({
    settingsRepository,
    appConfigRepository,
    eventPublisher,
  });

  // ---------------------------------------------------------------------------
  // Layer 5: IPC Adapters (depend on use cases)
  // ---------------------------------------------------------------------------
  const noteIPC = new NoteIPC({ noteUseCases: noteUseCases });
  const notebookIPC = new NotebookIPC({ notebookUseCases: notebookUseCases });
  const workspaceIPC = new WorkspaceIPC({ workspaceUseCases: workspaceUseCases });
  const tagIPC = new TagIPC({ tagUseCases: tagUseCases });
  const searchIPC = new SearchIPC({ searchUseCases: searchUseCases });

  // ---------------------------------------------------------------------------
  // Return Container
  // ---------------------------------------------------------------------------
  return {
    // Ports - Repositories
    noteRepository,
    notebookRepository,
    workspaceRepository,
    tagRepository,
    topicRepository,
    attachmentRepository,
    versionRepository,
    noteLinkRepository,
    settingsRepository,
    appConfigRepository,

    // Ports - Services
    fileStorage,
    markdownProcessor,
    eventPublisher,
    searchEngine,
    embedder,
    exporter,
    systemBridge,
    gitClient,
    fileWatcher,

    // Use Cases - Core
    noteUseCases,
    notebookUseCases,
    workspaceUseCases,
    tagUseCases,
    searchUseCases,

    // Use Cases - Extended
    taskUseCases,
    graphUseCases,
    versionUseCases,
    topicUseCases,
    attachmentUseCases,
    gitUseCases,
    databaseUseCases,
    quickCaptureUseCases,
    exportUseCases,
    systemUseCases,
    settingsUseCases,
    journalUseCases,
    quickNoteUseCases,

    // IPC Adapters
    noteIPC,
    notebookIPC,
    workspaceIPC,
    tagIPC,
    searchIPC,

    // Helpers
    getWorkspacePath,
    getDatabaseManager,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let containerInstance: Container | null = null;

export function initializeContainer(deps: ContainerDeps): Container {
  if (containerInstance) {
    throw new Error('Container already initialized');
  }
  containerInstance = createContainer(deps);
  return containerInstance;
}

export function getContainer(): Container {
  if (!containerInstance) {
    throw new Error('Container not initialized. Call initializeContainer first.');
  }
  return containerInstance;
}

export function resetContainer(): void {
  containerInstance = null;
  activeWorkspacePath = null;
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

export function registerIPCHandlers(): void {
  const container = getContainer();

  // Class-based IPC handlers
  container.noteIPC.registerHandlers();
  container.notebookIPC.registerHandlers();
  container.workspaceIPC.registerHandlers();
  container.tagIPC.registerHandlers();
  container.searchIPC.registerHandlers();

  // Function-based IPC handlers
  registerTaskHandlers({ taskUseCases: container.taskUseCases });
  registerTopicHandlers({ topicUseCases: container.topicUseCases });
  registerGraphHandlers({ graphUseCases: container.graphUseCases });
  registerVersionHandlers({
    versionUseCases: container.versionUseCases,
    noteUseCases: container.noteUseCases,
  });
  registerAttachmentHandlers({ attachmentUseCases: container.attachmentUseCases });
  registerExportHandlers({ exportUseCases: container.exportUseCases });
  registerGitHandlers({
    getGitStatus: container.gitUseCases.getStatus,
    initGitRepo: container.gitUseCases.init,
    gitCommit: container.gitUseCases.commit,
    gitPull: container.gitUseCases.pull,
    gitPush: container.gitUseCases.push,
    gitSync: container.gitUseCases.sync,
    setGitRemote: container.gitUseCases.setRemote,
    getGitCommits: container.gitUseCases.getCommits,
  });
  registerDatabaseHandlers({
    getDatabaseStatus: container.databaseUseCases.getStatus,
    vacuumDatabase: container.databaseUseCases.vacuum,
    checkDatabaseIntegrity: container.databaseUseCases.checkIntegrity,
  });
  registerQuickCaptureHandlers({
    appendToJournal: (content: string, workspaceId?: string) =>
      container.quickCaptureUseCases.appendToJournal(content, workspaceId),
  });
  registerJournalHandlers({
    journalUseCases: container.journalUseCases,
  });
  registerQuickNoteHandlers({
    quickNoteUseCases: container.quickNoteUseCases,
  });
  registerSystemHandlers({
    getSystemFonts: container.systemUseCases.getFonts,
  });
  registerSettingsHandlers({
    getSetting: container.settingsUseCases.get,
    setSetting: container.settingsUseCases.set,
    getAllSettings: container.settingsUseCases.getAll,
    getAppearanceSettings: container.settingsUseCases.getAppearance,
    setTheme: container.settingsUseCases.setTheme,
    setAccentColor: container.settingsUseCases.setAccentColor,
    updateFontSettings: container.settingsUseCases.updateFontSettings,
    resetFontSettings: container.settingsUseCases.resetFontSettings,
    getEditorSettings: container.settingsUseCases.getEditor,
    updateEditorSettings: container.settingsUseCases.updateEditor,
    resetEditorSettings: container.settingsUseCases.resetEditor,
    getShortcuts: container.settingsUseCases.getShortcuts,
    setShortcut: container.settingsUseCases.setShortcut,
    resetShortcut: container.settingsUseCases.resetShortcut,
    resetAllShortcuts: container.settingsUseCases.resetAllShortcuts,
  });

  // Performance monitoring handlers
  const perfMonitor = getPerformanceMonitor();
  registerPerformanceHandlers({
    getSnapshot: (sinceMs?: number) => perfMonitor.getSnapshot(sinceMs),
    getMemoryMetrics: () => perfMonitor.getMemoryMetrics(),
    getCPUMetrics: () => perfMonitor.getCPUMetrics(),
    getIPCMetrics: (sinceMs?: number) => perfMonitor.getIPCMetrics(sinceMs),
    getDatabaseMetrics: (sinceMs?: number) => perfMonitor.getDatabaseMetrics(sinceMs),
    getStartupMetrics: () => ({ ...perfMonitor.getSnapshot().startup }),
    clearHistory: () => perfMonitor.clearHistory(),
    getRendererMetrics: (window) => perfMonitor.getRendererMetrics(window),
  });
}

export function unregisterIPCHandlers(): void {
  const container = getContainer();

  // Class-based IPC handlers
  container.noteIPC.unregisterHandlers();
  container.notebookIPC.unregisterHandlers();
  container.workspaceIPC.unregisterHandlers();
  container.tagIPC.unregisterHandlers();
  container.searchIPC.unregisterHandlers();

  // Function-based IPC handlers
  unregisterTaskHandlers();
  unregisterTopicHandlers();
  unregisterGraphHandlers();
  unregisterVersionHandlers();
  unregisterAttachmentHandlers();
  unregisterExportHandlers();
  unregisterGitHandlers();
  unregisterDatabaseHandlers();
  unregisterQuickCaptureHandlers();
  unregisterJournalHandlers();
  unregisterQuickNoteHandlers();
  unregisterSystemHandlers();
  unregisterSettingsHandlers();
  unregisterPerformanceHandlers();
}
