/**
 * Application DI Container
 *
 * Wires all hexagonal architecture components using dependency injection.
 * This is the composition root where all dependencies are resolved.
 */

// Shared Layer
import type { Database } from '@main/shared';
import { createEmbeddingWorker } from '@main/infrastructure/workers/EmbeddingWorker';

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
  IAIProviderKeyStore,
  // Outbound Ports (Services)
  IFileStorage,
  IMarkdownProcessor,
  IEventPublisher,
  ISearchEngine,
  IEmbedder,
  IIndexRepository,
  IReranker,
  ITranscriber,
  ISummarizationStrategy,
  IMeetingRecordingRepository,
  ITemplateRepository,
  IExporter,
  ISystemBridge,
  IGitClient,
  IIdGenerator,
  IPathService,
  IPerformanceMonitor,
  ITextGenerator,
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
  IScratchUseCases,
  IAIUseCases,
  IIndexUseCases,
  IMeetingUseCases,
  ITemplateUseCases,
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
  createScratchUseCases,
  createAIUseCases,
  createIndexUseCases,
  createMeetingUseCases,
  createTemplateUseCases,
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
  registerScratchHandlers,
  unregisterScratchHandlers,
  registerSystemHandlers,
  unregisterSystemHandlers,
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  registerPerformanceHandlers,
  unregisterPerformanceHandlers,
  registerAIHandlers,
  unregisterAIHandlers,
  registerIndexHandlers,
  unregisterIndexHandlers,
  registerMeetingHandlers,
  unregisterMeetingHandlers,
  registerTemplateHandlers,
  unregisterTemplateHandlers,
  // Outbound (Secondary) - Persistence
  NoteRepository,
  IndexRepository,
  NotebookRepository,
  WorkspaceRepository,
  TagRepository,
  TopicRepository,
  AttachmentRepository,
  VersionRepository,
  NoteLinkRepository,
  SettingsRepository,
  AppConfigRepository,
  SecureAIProviderKeyStore,
  JournalReader,
  MeetingRecordingRepository,
  FileSystemTemplateRepository,
  // Outbound (Secondary) - Storage
  FileSystemStorage,
  // Outbound (Secondary) - Services
  MarkdownProcessor,
  SearchEngine,
  Embedder,
  Exporter,
  SystemBridge,
  GitClient,
  CryptoIdGenerator,
  NodePathService,
  FileWatcher,
  AISDKTextGenerator,
  LocalReranker,
  WhisperTranscriber,
  SingleShotSummarizer,
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
  /** Created at app boot before the container so startup-phase timing
   *  is captured from the earliest possible point. Passed in instead of
   *  constructed here. */
  perfMonitor: IPerformanceMonitor;
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
  aiProviderKeyStore: IAIProviderKeyStore;

  // Ports - Services
  perfMonitor: IPerformanceMonitor;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher: IEventPublisher;
  searchEngine: ISearchEngine;
  embedder: IEmbedder;
  reranker: IReranker;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  meetingRepository: IMeetingRecordingRepository;
  templateRepository: ITemplateRepository;
  exporter: IExporter;
  systemBridge: ISystemBridge;
  gitClient: IGitClient;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  textGenerator: ITextGenerator;
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
  scratchUseCases: IScratchUseCases;
  aiUseCases: IAIUseCases;
  indexUseCases: IIndexUseCases;
  meetingUseCases: IMeetingUseCases;
  templateUseCases: ITemplateUseCases;
  indexRepository: IIndexRepository;

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
  const { db, dbManager, perfMonitor } = deps;

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
  const idGenerator: IIdGenerator = new CryptoIdGenerator();
  const pathService: IPathService = new NodePathService();
  const embeddingWorker = createEmbeddingWorker();

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
  const aiProviderKeyStore: IAIProviderKeyStore = new SecureAIProviderKeyStore();

  const noteRepository: INoteRepository = new NoteRepository({
    db,
    fileStorage,
    getWorkspacePath,
  });

  const indexRepository: IIndexRepository = new IndexRepository({ db });

  const meetingRepository: IMeetingRecordingRepository = new MeetingRecordingRepository({ db });

  const templateRepository: ITemplateRepository = new FileSystemTemplateRepository({
    fileStorage,
    workspaceRepository,
    markdownProcessor,
    pathService,
  });

  const journalReader = new JournalReader({ db, fileStorage });

  // ---------------------------------------------------------------------------
  // Layer 3: Domain Services (depend on repositories)
  // ---------------------------------------------------------------------------
  const embedder: IEmbedder = new Embedder({
    workerService: embeddingWorker,
  });

  const reranker: IReranker = new LocalReranker({
    workerService: embeddingWorker,
  });

  const transcriber: ITranscriber = new WhisperTranscriber({
    workerService: embeddingWorker,
  });

  const searchEngine: ISearchEngine = new SearchEngine({
    db,
    noteRepository,
  });

  const textGenerator: ITextGenerator = new AISDKTextGenerator({
    appConfigRepository,
    aiProviderKeyStore,
  });

  const summarizer: ISummarizationStrategy = new SingleShotSummarizer({ textGenerator });

  // ---------------------------------------------------------------------------
  // Layer 4: Use Cases (depend on repositories and services)
  // ---------------------------------------------------------------------------
  const indexUseCases = createIndexUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    embedder,
    indexRepository,
    pathService,
  });

  const noteUseCases = createNoteUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
    appConfigRepository,
    idGenerator,
    pathService,
    eventPublisher,
  });

  const notebookUseCases = createNotebookUseCases({
    notebookRepository,
    idGenerator,
    eventPublisher,
  });

  const workspaceUseCases = createWorkspaceUseCases({
    workspaceRepository,
    noteRepository,
    fileStorage,
    systemBridge,
    markdownProcessor,
    appConfigRepository,
    idGenerator,
    pathService,
    indexNote: indexUseCases.indexNote,
    eventPublisher,
  });

  // File watcher needs syncWorkspace from the use cases — construct after.
  const fileWatcher = new FileWatcher({
    workspaceRepository,
    eventPublisher,
    syncWorkspace: async (workspaceId) => {
      await workspaceUseCases.syncWorkspace.execute({ workspaceId });
    },
  });

  const tagUseCases = createTagUseCases({
    tagRepository,
    idGenerator,
    eventPublisher,
  });

  const searchUseCases = createSearchUseCases({
    noteRepository,
    searchEngine,
    embedder,
    indexRepository,
    reranker,
  });

  // Task use cases
  const taskUseCases = createTaskUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
    pathService,
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
    pathService,
  });

  // Topic use cases
  const topicUseCases = createTopicUseCases({
    noteRepository,
    topicRepository,
    workspaceRepository,
    appConfigRepository,
    fileStorage,
    embedder,
    markdownProcessor,
    idGenerator,
    pathService,
    indexRepository,
    indexNote: indexUseCases.indexNote,
    eventPublisher,
  });

  // Attachment use cases
  const attachmentUseCases = createAttachmentUseCases({
    noteRepository,
    attachmentRepository,
    workspaceRepository,
    fileStorage,
    idGenerator,
    pathService,
  });

  // Git use cases
  const gitUseCases = createGitUseCases({
    workspaceRepository,
    gitClient,
  });

  // Database use cases
  const databaseUseCases = createDatabaseUseCases({
    getDatabaseManager,
    noteRepository,
    notebookRepository,
    tagRepository,
  });

  // Quick capture use cases
  const quickCaptureUseCases = createQuickCaptureUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
    idGenerator,
    pathService,
    eventPublisher,
  });

  // Journal use cases
  const journalUseCases = createJournalUseCases({
    noteRepository,
    journalReader,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
    idGenerator,
    pathService,
    eventPublisher,
  });

  // Quick note (slot-based) use cases
  const quickNoteUseCases = createQuickNoteUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
    idGenerator,
    pathService,
    eventPublisher,
  });

  // Scratch editor use cases (open arbitrary .md files outside any workspace)
  const scratchUseCases = createScratchUseCases({
    fileStorage,
    systemBridge,
    pathService,
  });

  // Export use cases
  const exportUseCases = createExportUseCases({
    noteRepository,
    workspaceRepository,
    fileStorage,
    markdownProcessor,
    exporter,
    pathService,
  });

  // System use cases
  const systemUseCases = createSystemUseCases({
    systemBridge,
  });

  // Settings use cases
  const settingsUseCases = createSettingsUseCases({
    settingsRepository,
    appConfigRepository,
    aiProviderKeyStore,
    eventPublisher,
  });

  // AI-assisted PKM use cases
  const aiUseCases = createAIUseCases({
    hybridSearch: searchUseCases.hybridSearch,
    noteRepository,
    markdownProcessor,
    textGenerator,
    indexRepository,
  });

  // Meeting recorder use cases
  const meetingUseCases = createMeetingUseCases({
    meetingRepository,
    workspaceRepository,
    fileStorage,
    idGenerator,
    pathService,
    transcriber,
    summarizer,
    appendToJournal: (content, workspaceId) =>
      quickCaptureUseCases.appendToJournal(content, workspaceId),
  });

  // Template use cases — composes the existing CreateNote use case
  // for the actual note creation, so templated notes go through the
  // same write/index/event pipeline as any other.
  const templateUseCases = createTemplateUseCases({
    templateRepository,
    workspaceRepository,
    createNote: noteUseCases.createNote,
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
    aiProviderKeyStore,

    // Ports - Services
    perfMonitor,
    fileStorage,
    markdownProcessor,
    eventPublisher,
    searchEngine,
    embedder,
    reranker,
    transcriber,
    summarizer,
    meetingRepository,
    templateRepository,
    indexRepository,
    exporter,
    systemBridge,
    gitClient,
    idGenerator,
    pathService,
    textGenerator,
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
    scratchUseCases,
    aiUseCases,
    indexUseCases,
    meetingUseCases,
    templateUseCases,

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
  registerScratchHandlers({
    scratchUseCases: container.scratchUseCases,
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
    getAI: container.settingsUseCases.getAI,
    updateAI: container.settingsUseCases.updateAI,
    resetAI: container.settingsUseCases.resetAI,
    getAIProviderKeys: container.settingsUseCases.getAIProviderKeys,
    setAIProviderKey: container.settingsUseCases.setAIProviderKey,
    deleteAIProviderKey: container.settingsUseCases.deleteAIProviderKey,
  });
  registerAIHandlers({
    aiUseCases: container.aiUseCases,
  });
  registerIndexHandlers({ indexUseCases: container.indexUseCases });
  registerMeetingHandlers({ meetingUseCases: container.meetingUseCases });
  registerTemplateHandlers({ templateUseCases: container.templateUseCases });

  // Performance monitoring handlers
  const { perfMonitor } = container;
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
  unregisterScratchHandlers();
  unregisterSystemHandlers();
  unregisterSettingsHandlers();
  unregisterAIHandlers();
  unregisterIndexHandlers();
  unregisterMeetingHandlers();
  unregisterTemplateHandlers();
  unregisterPerformanceHandlers();
}
