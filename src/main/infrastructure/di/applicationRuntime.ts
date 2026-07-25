/**
 * Application Runtime Composition
 *
 * Wires all hexagonal architecture components using dependency injection.
 * This is the composition root where all dependencies are resolved.
 */

// Shared Layer
import type { Database } from '@main/shared';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import {
  createEmbeddingWorker,
  EmbeddingWorker,
} from '@main/infrastructure/workers/EmbeddingWorker';
import { JobRunner } from '@main/infrastructure/workers/JobRunner';
import { createMeetingFinalizeJobHandler } from '@main/infrastructure/workers/meetingFinalizeJob';
import { TopicOrganizerLive } from '@main/infrastructure/workers/TopicOrganizer';
import { WhisperServer } from '@main/infrastructure/workers/WhisperServer';
import { getMLStatusTracker } from '@main/infrastructure/workers/MLStatusTracker';
import { TEMPLATE_STARTER_PACK } from '@main/infrastructure/seed/templateStarterPack';
import { instrumentIpcHandlers } from '@main/infrastructure/electron/ipcInstrumentation';
import { calendarBridgePath } from '@main/infrastructure/utils/calendarBridgePath';

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
  IJobRepository,
  IEchoCanceller,
  // Inbound Ports (Use Cases)
} from '@domain';
import {
  WorkspaceActivationPort,
  AIUseCasesPort,
  AttachmentUseCasesPort,
  DailyReviewUseCasesPort,
  DatabaseUseCasesPort,
  ExportUseCasesPort,
  GitUseCasesPort,
  GraphUseCasesPort,
  IndexUseCasesPort,
  JournalUseCasesPort,
  MeetingUseCasesPort,
  NoteUseCasesPort,
  NotebookUseCasesPort,
  QuickCaptureUseCasesPort,
  QuickNoteUseCasesPort,
  ScratchUseCasesPort,
  SearchUseCasesPort,
  SettingsUseCasesPort,
  StatusReportUseCasesPort,
  SystemUseCasesPort,
  TagUseCasesPort,
  TaskUseCasesPort,
  TemplateUseCasesPort,
  TopicUseCasesPort,
  VersionUseCasesPort,
  WorkspaceUseCasesPort,
} from '@domain';
import {
  AIProviderKeyStoreLive,
  AppConfigRepositoryLive,
  AttachmentRepositoryLive,
  CalendarSourceLive,
  DatabaseManagerLive,
  EchoCancellerLive,
  EmbedderLive,
  EventPublisherLive,
  ExporterLive,
  ExternalSourceRegistryLive,
  FileStorageLive,
  FileWatcherLive,
  GitClientLive,
  GlobalShortcutRegistrarLive,
  IdGeneratorLive,
  IndexRepositoryLive,
  JobRepositoryLive,
  JournalReaderLive,
  LinearSourceLive,
  MailSourceLive,
  MarkdownProcessorLive,
  MeetingRecordingRepositoryLive,
  NoteLinkRepositoryLive,
  NoteRepositoryLive,
  NotebookRepositoryLive,
  PathServiceLive,
  PerformanceMonitorLive,
  RerankerLive,
  SearchEngineLive,
  SettingsRepositoryLive,
  SummarizationStrategyLive,
  SystemBridgeLive,
  TagRepositoryLive,
  TemplateRepositoryLive,
  TextGeneratorLive,
  TopicRepositoryLive,
  TranscriberLive,
  VersionRepositoryLive,
  WorkspaceRepositoryLive,
} from '@main/adapters/out/layers';
// Application Layer - Use Cases
import {
  MEETING_FINALIZE_JOB,
  MeetingUseCasesLive,
} from '@main/application/usecases/meeting/meetingUseCases';
import { DailyReviewUseCasesLive } from '@main/application/usecases/dailyReview/dailyReviewUseCases';
import { SettingsUseCasesLive } from '@main/application/usecases/settings/settingsUseCases';
import { IndexUseCasesLive } from '@main/application/usecases/indexing/indexUseCases';
import { GitUseCasesLive } from '@main/application/usecases/git/gitUseCases';
import { TopicUseCasesLive } from '@main/application/usecases/topic/topicUseCases';
import { NoteUseCasesLive } from '@main/application/usecases/note/noteUseCases';
import { WorkspaceUseCasesLive } from '@main/application/usecases/workspace/workspaceUseCases';
import { SystemUseCasesLive } from '@main/application/usecases/system/systemUseCases';
import { NotebookUseCasesLive } from '@main/application/usecases/notebook/notebookUseCases';
import { TagUseCasesLive } from '@main/application/usecases/tag/tagUseCases';
import { DatabaseUseCasesLive } from '@main/application/usecases/database/databaseUseCases';
import { ScratchUseCasesLive } from '@main/application/usecases/scratch/scratchUseCases';
import { GraphUseCasesLive } from '@main/application/usecases/graph/graphUseCases';
import { VersionUseCasesLive } from '@main/application/usecases/version/versionUseCases';
import { TaskUseCasesLive } from '@main/application/usecases/task/taskUseCases';
import { JournalUseCasesLive } from '@main/application/usecases/journal/journalUseCases';
import { StatusReportUseCasesLive } from '@main/application/usecases/statusReport/statusReportUseCases';
import { QuickCaptureUseCasesLive } from '@main/application/usecases/quickCapture/quickCaptureUseCases';
import { QuickNoteUseCasesLive } from '@main/application/usecases/quickNote/quickNoteUseCases';
import { TemplateUseCasesLive } from '@main/application/usecases/template/templateUseCases';
import { AttachmentUseCasesLive } from '@main/application/usecases/attachment/attachmentUseCases';
import { ExportUseCasesLive } from '@main/application/usecases/export/exportUseCases';
import { SearchUseCasesLive } from '@main/application/usecases/search/searchUseCases';
import { AIUseCasesLive } from '@main/application/usecases/ai/aiUseCases';
import type { RunMeetingEffect } from '@main/adapters/in/ipc/MeetingIPC';
import type { RunDailyReviewEffect } from '@main/adapters/in/ipc/DailyReviewIPC';
import type { RunSettingsEffect } from '@main/adapters/in/ipc/SettingsIPC';
import type { RunIndexEffect } from '@main/adapters/in/ipc/IndexIPC';
import type { RunNoteEffect } from '@main/adapters/in/ipc/NoteIPC';
import type { RunWorkspaceEffect } from '@main/adapters/in/ipc/WorkspaceIPC';
import type { RunSystemEffect } from '@main/adapters/in/ipc/SystemIPC';
import type { RunNotebookEffect } from '@main/adapters/in/ipc/NotebookIPC';
import type { RunTagEffect } from '@main/adapters/in/ipc/TagIPC';
import type { RunDatabaseEffect } from '@main/adapters/in/ipc/DatabaseIPC';
import type { RunScratchEffect } from '@main/adapters/in/ipc/ScratchIPC';
import type { RunGraphEffect } from '@main/adapters/in/ipc/GraphIPC';
import type { RunVersionEffect } from '@main/adapters/in/ipc/VersionIPC';
import type { RunTaskEffect } from '@main/adapters/in/ipc/TaskIPC';
import type { RunJournalEffect } from '@main/adapters/in/ipc/JournalIPC';
import type { RunStatusReportEffect } from '@main/adapters/in/ipc/StatusReportIPC';
import type { RunQuickCaptureEffect } from '@main/adapters/in/ipc/QuickCaptureIPC';
import type { RunQuickNoteEffect } from '@main/adapters/in/ipc/QuickNoteIPC';
import type { RunTemplateEffect } from '@main/adapters/in/ipc/TemplateIPC';
import type { RunAttachmentEffect } from '@main/adapters/in/ipc/AttachmentIPC';
import type { RunExportEffect } from '@main/adapters/in/ipc/ExportIPC';
import type { RunSearchEffect } from '@main/adapters/in/ipc/SearchIPC';
import type { RunAIEffect } from '@main/adapters/in/ipc/AIIPC';
import type { RunGitEffect } from '@main/adapters/in/ipc/GitIPC';
import type { RunTopicEffect } from '@main/adapters/in/ipc/TopicIPC';

// Adapters Layer
import {
  // Inbound (Primary) - IPC
  registerNoteHandlers,
  unregisterNoteHandlers,
  registerNotebookHandlers,
  unregisterNotebookHandlers,
  registerWorkspaceHandlers,
  unregisterWorkspaceHandlers,
  registerTagHandlers,
  unregisterTagHandlers,
  registerSearchHandlers,
  unregisterSearchHandlers,
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
  registerDailyReviewHandlers,
  unregisterDailyReviewHandlers,
  registerStatusReportHandlers,
  unregisterStatusReportHandlers,
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
  GlobalShortcutRegistrar,
  GitClient,
  CryptoIdGenerator,
  NodePathService,
  FileWatcher,
  AISDKTextGenerator,
  LocalReranker,
  WhisperCppTranscriber,
  OnnxEchoCanceller,
  SingleShotSummarizer,
  LinearSource,
  AppleCalendarSource,
  AppleMailSource,
  ExternalSourceRegistry,
  JobRepository,
  // Outbound (Secondary) - Events
  EventPublisher,
} from '@adapters';

// ============================================================================
// Application Runtime Types
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

export interface ApplicationRuntimeDeps {
  db: Database;
  dbManager?: DatabaseManagerInterface;
  /** Created at app boot before the application runtime so startup-phase timing
   *  is captured from the earliest possible point. Passed in instead of
   *  constructed here. */
  perfMonitor: IPerformanceMonitor;
}

export interface ApplicationRuntime {
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
  jobRepository: IJobRepository;

  // Workers
  jobRunner: JobRunner;
  effectRuntime: {
    start: () => Promise<void>;
    dispose: () => Promise<void>;
  };
  embeddingWorker: EmbeddingWorker;
  liveTranscriber: WhisperServer;
  echoCanceller: IEchoCanceller;

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
  globalShortcutRegistrar: GlobalShortcutRegistrar;
  gitClient: IGitClient;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  textGenerator: ITextGenerator;
  fileWatcher: FileWatcher;

  // Use Cases - Core
  runNoteEffect: RunNoteEffect;
  runNotebookEffect: RunNotebookEffect;
  runWorkspaceEffect: RunWorkspaceEffect;
  runTagEffect: RunTagEffect;
  runSearchEffect: RunSearchEffect;

  // Use Cases - Extended
  runTaskEffect: RunTaskEffect;
  runGraphEffect: RunGraphEffect;
  runVersionEffect: RunVersionEffect;
  runTopicEffect: RunTopicEffect;
  runAttachmentEffect: RunAttachmentEffect;
  runGitEffect: RunGitEffect;
  runDatabaseEffect: RunDatabaseEffect;
  runQuickCaptureEffect: RunQuickCaptureEffect;
  runExportEffect: RunExportEffect;
  runSystemEffect: RunSystemEffect;
  runSettingsEffect: RunSettingsEffect;
  runJournalEffect: RunJournalEffect;
  runQuickNoteEffect: RunQuickNoteEffect;
  runScratchEffect: RunScratchEffect;
  runAIEffect: RunAIEffect;
  runIndexEffect: RunIndexEffect;
  runMeetingEffect: RunMeetingEffect;
  runTemplateEffect: RunTemplateEffect;
  runDailyReviewEffect: RunDailyReviewEffect;
  runStatusReportEffect: RunStatusReportEffect;
  indexRepository: IIndexRepository;

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
// Application Runtime Factory
// ============================================================================

export function createApplicationRuntime(
  deps: ApplicationRuntimeDeps,
): ApplicationRuntime {
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
  const globalShortcutRegistrar = new GlobalShortcutRegistrar();
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

  const transcriber: ITranscriber = new WhisperCppTranscriber({
    // Reuse the existing model-download progress channel so Settings →
    // Recording's progress bar lights up while the GGML model downloads.
    onDownloadProgress: ({ file, loaded, total }) =>
      getMLStatusTracker().broadcastModelDownloadProgress({
        model: 'whisper',
        file,
        loaded,
        total,
      }),
  });

  // Offline acoustic echo canceller — scrubs system-audio bleed from the mic
  // track before transcription so the "You" transcript isn't polluted on
  // speakers. Best-effort; finalize falls back to the raw mic if it fails.
  const echoCanceller = new OnnxEchoCanceller();

  // Resident whisper-server for the live (raw) draft while recording. Started
  // on demand when a recording begins; the clean transcript is still the batch
  // finalize pass.
  const liveTranscriber = new WhisperServer();

  // Durable background-job queue (libSQL-backed). The runner polls for due
  // jobs, executes registered handlers, and self-cleans: bounded retries →
  // dead-letter, adaptive idle backoff, crash recovery, retention prune.
  // Started/stopped by the app lifecycle (index.ts). Register handlers via
  // jobRunner.register(type, handler) before/after start.
  const jobRepository: IJobRepository = new JobRepository({ db });
  const jobRunner = new JobRunner({
    repository: jobRepository,
    idGenerator,
  });
  const workerLayer = Layer.mergeAll(
    JobRunner.layer(jobRunner),
    WhisperServer.layer(liveTranscriber),
    EmbeddingWorker.layer(embeddingWorker),
  );

  const searchEngine: ISearchEngine = new SearchEngine({
    db,
    noteRepository,
  });

  const textGenerator: ITextGenerator = new AISDKTextGenerator({
    appConfigRepository,
    aiProviderKeyStore,
    runPromise: Effect.runPromise,
  });

  const summarizer: ISummarizationStrategy = new SingleShotSummarizer({ textGenerator });

  // ---------------------------------------------------------------------------
  // Layer 4: Use Cases (depend on repositories and services)
  // ---------------------------------------------------------------------------
  let runIndexEffect: RunIndexEffect = () =>
    Promise.reject(new Error('Effect runtime is not initialized'));
  let runNoteEffect: RunNoteEffect = () =>
    Promise.reject(new Error('Effect runtime is not initialized'));

  let runWorkspaceEffect: RunWorkspaceEffect = () =>
    Promise.reject(new Error('Effect runtime is not initialized'));

  // File watcher needs syncWorkspace from the use cases — construct after.
  const fileWatcher = new FileWatcher({
    workspaceRepository,
    eventPublisher,
    runFork: Effect.runFork,
    syncWorkspace: async (workspaceId) => {
      await runWorkspaceEffect((service) =>
        service.syncWorkspace.execute({ workspaceId }),
      );
    },
  });

  // Daily Review use cases — pure read aggregation over journal +
  // meetings + tasks + notes for the /today page.
  // Today-page external sources. Calendar uses the signed EventKit bridge;
  // Mail uses a bounded Apple Events summary; both self-guard off-platform.
  // Linear reads its key from config and returns [] when unset.
  const calendarSource = new AppleCalendarSource(
    calendarBridgePath(),
    Effect.runPromise,
  );
  const mailSource = new AppleMailSource(Effect.runPromise);
  const linearSource = new LinearSource({ appConfigRepository });
  const externalSourceRegistry = new ExternalSourceRegistry({
    sources: [linearSource, mailSource, calendarSource],
    appConfigRepository,
  });
  const outAdaptersLayer = Layer.mergeAll(
    AIProviderKeyStoreLive(aiProviderKeyStore),
    AppConfigRepositoryLive(appConfigRepository),
    AttachmentRepositoryLive(attachmentRepository),
    CalendarSourceLive(calendarSource),
    DatabaseManagerLive(getDatabaseManager()),
    EchoCancellerLive(echoCanceller),
    EmbedderLive(embedder),
    EventPublisherLive(eventPublisher),
    ExporterLive(exporter),
    ExternalSourceRegistryLive(externalSourceRegistry),
    FileStorageLive(fileStorage),
    FileWatcherLive(fileWatcher),
    GitClientLive(gitClient),
    GlobalShortcutRegistrarLive(globalShortcutRegistrar),
    IdGeneratorLive(idGenerator),
    IndexRepositoryLive(indexRepository),
    JobRepositoryLive(jobRepository),
    JournalReaderLive(journalReader),
    LinearSourceLive(linearSource),
    MailSourceLive(mailSource),
    MarkdownProcessorLive(markdownProcessor),
    MeetingRecordingRepositoryLive(meetingRepository),
    NoteLinkRepositoryLive(noteLinkRepository),
    NoteRepositoryLive(noteRepository),
    NotebookRepositoryLive(notebookRepository),
    PathServiceLive(pathService),
    PerformanceMonitorLive(perfMonitor),
    RerankerLive(reranker),
    SearchEngineLive(searchEngine),
    SettingsRepositoryLive(settingsRepository),
    SummarizationStrategyLive(summarizer),
    SystemBridgeLive(systemBridge),
    TagRepositoryLive(tagRepository),
    TemplateRepositoryLive(templateRepository),
    TextGeneratorLive(textGenerator),
    TopicRepositoryLive(topicRepository),
    TranscriberLive(transcriber),
    VersionRepositoryLive(versionRepository),
    WorkspaceRepositoryLive(workspaceRepository),
    Layer.succeed(WorkspaceActivationPort, {
      afterActivated: (workspaceId: string) =>
        Effect.tryPromise({
          try: () =>
            templateRepository.seedDefaultsIfEmpty(
              workspaceId,
              TEMPLATE_STARTER_PACK,
            ),
          catch: (error) =>
            error instanceof Error ? error : new Error(String(error)),
        }),
    }),
  );

  const baseLayer = Layer.mergeAll(workerLayer, outAdaptersLayer);
  const indexAndWorkspaceLayer = WorkspaceUseCasesLive.pipe(
    Layer.provideMerge(IndexUseCasesLive),
  );
  const journalAndTaskLayer = Layer.mergeAll(
    JournalUseCasesLive,
    TaskUseCasesLive,
  );
  const dailyReviewLayer = DailyReviewUseCasesLive.pipe(
    Layer.provide(
      Layer.mergeAll(journalAndTaskLayer, QuickCaptureUseCasesLive),
    ),
  );
  const statusReportLayer = StatusReportUseCasesLive.pipe(
    Layer.provide(journalAndTaskLayer),
  );
  const meetingLayer = MeetingUseCasesLive.pipe(
    Layer.provide(QuickCaptureUseCasesLive),
  );
  const quickNoteLayer = QuickNoteUseCasesLive.pipe(
    Layer.provide(NoteUseCasesLive),
  );
  const templateLayer = TemplateUseCasesLive.pipe(
    Layer.provide(NoteUseCasesLive),
  );
  const aiLayer = AIUseCasesLive.pipe(
    Layer.provide(SearchUseCasesLive),
  );
  // Topics organize themselves in the background — the organizer fiber lives
  // as long as the runtime, so nothing user-facing has to trigger a pass.
  const topicLayer = TopicOrganizerLive().pipe(
    Layer.provideMerge(TopicUseCasesLive.pipe(Layer.provide(IndexUseCasesLive))),
  );
  const nativeUseCasesLayer = Layer.mergeAll(
    meetingLayer,
    dailyReviewLayer,
    SettingsUseCasesLive,
    indexAndWorkspaceLayer,
    NoteUseCasesLive,
    SystemUseCasesLive,
    NotebookUseCasesLive,
    TagUseCasesLive,
    DatabaseUseCasesLive,
    ScratchUseCasesLive,
    GraphUseCasesLive,
    VersionUseCasesLive,
    journalAndTaskLayer,
    QuickCaptureUseCasesLive,
    statusReportLayer,
    quickNoteLayer,
    templateLayer,
    AttachmentUseCasesLive,
    ExportUseCasesLive,
    SearchUseCasesLive,
    aiLayer,
    GitUseCasesLive,
    topicLayer,
  ).pipe(Layer.provideMerge(baseLayer));
  const managedRuntime = ManagedRuntime.make(nativeUseCasesLayer);
  const runMeetingEffect: RunMeetingEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      MeetingUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runDailyReviewEffect: RunDailyReviewEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      DailyReviewUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runSettingsEffect: RunSettingsEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      SettingsUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  runIndexEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      IndexUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  runNoteEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      NoteUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  runWorkspaceEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      WorkspaceUseCasesPort.pipe(
        Effect.flatMap((service) => use(service)),
      ),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runSystemEffect: RunSystemEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      SystemUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runNotebookEffect: RunNotebookEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      NotebookUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTagEffect: RunTagEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      TagUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runDatabaseEffect: RunDatabaseEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      DatabaseUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runScratchEffect: RunScratchEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      ScratchUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runGraphEffect: RunGraphEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      GraphUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runVersionEffect: RunVersionEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      VersionUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTaskEffect: RunTaskEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      TaskUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runJournalEffect: RunJournalEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      JournalUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runStatusReportEffect: RunStatusReportEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      StatusReportUseCasesPort.pipe(
        Effect.flatMap((service) => use(service)),
      ),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runQuickCaptureEffect: RunQuickCaptureEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      QuickCaptureUseCasesPort.pipe(
        Effect.flatMap((service) => use(service)),
      ),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runQuickNoteEffect: RunQuickNoteEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      QuickNoteUseCasesPort.pipe(
        Effect.flatMap((service) => use(service)),
      ),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTemplateEffect: RunTemplateEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      TemplateUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runAttachmentEffect: RunAttachmentEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      AttachmentUseCasesPort.pipe(
        Effect.flatMap((service) => use(service)),
      ),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runExportEffect: RunExportEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      ExportUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runSearchEffect: RunSearchEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      SearchUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runAIEffect: RunAIEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      AIUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runGitEffect: RunGitEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      GitUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTopicEffect: RunTopicEffect = async (use) => {
    const exit = await managedRuntime.runPromiseExit(
      TopicUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  jobRunner.register(
    MEETING_FINALIZE_JOB,
    createMeetingFinalizeJobHandler(async (request, signal) => {
      await runMeetingEffect((service) =>
        service.finalizeRecording.execute(request, { signal }).pipe(Effect.asVoid),
      );
    }),
  );
  const effectRuntime = {
    start: async () => {
      await managedRuntime.runtime();
    },
    dispose: () => managedRuntime.dispose(),
  };

  // ---------------------------------------------------------------------------
  // IPC adapters are registered as functions in registerIPCHandlers() below —
  // they have no per-instance state, so the runtime exposes use cases only.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Return Application Runtime
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
    jobRepository,

    // Workers
    jobRunner,
    effectRuntime,
    embeddingWorker,
    liveTranscriber,
    echoCanceller,

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
    globalShortcutRegistrar,
    gitClient,
    idGenerator,
    pathService,
    textGenerator,
    fileWatcher,

    // Use Cases - Core
    runNoteEffect,
    runNotebookEffect,
    runWorkspaceEffect,
    runTagEffect,
    runSearchEffect,

    // Use Cases - Extended
    runTaskEffect,
    runGraphEffect,
    runVersionEffect,
    runTopicEffect,
    runAttachmentEffect,
    runGitEffect,
    runDatabaseEffect,
    runQuickCaptureEffect,
    runExportEffect,
    runSystemEffect,
    runSettingsEffect,
    runJournalEffect,
    runQuickNoteEffect,
    runScratchEffect,
    runAIEffect,
    runIndexEffect,
    runMeetingEffect,
    runTemplateEffect,
    runDailyReviewEffect,
    runStatusReportEffect,

    // Helpers
    getWorkspacePath,
    getDatabaseManager,
  };
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

export function registerIPCHandlers(runtime: ApplicationRuntime): void {

  // Must run before any handler registration below so all channels are timed
  instrumentIpcHandlers((channel, durationMs, success) =>
    runtime.perfMonitor.recordIPCCall(channel, durationMs, success),
  );

  // Function-based IPC handlers
  registerNoteHandlers({ runNoteEffect: runtime.runNoteEffect });
  registerNotebookHandlers({
    runNotebookEffect: runtime.runNotebookEffect,
  });
  registerWorkspaceHandlers({
    runWorkspaceEffect: runtime.runWorkspaceEffect,
  });
  registerTagHandlers({ runTagEffect: runtime.runTagEffect });
  registerSearchHandlers({ runSearchEffect: runtime.runSearchEffect });
  registerTaskHandlers({ runTaskEffect: runtime.runTaskEffect });
  registerTopicHandlers({ runTopicEffect: runtime.runTopicEffect });
  registerGraphHandlers({ runGraphEffect: runtime.runGraphEffect });
  registerVersionHandlers({
    runVersionEffect: runtime.runVersionEffect,
    runNoteEffect: runtime.runNoteEffect,
  });
  registerAttachmentHandlers({
    runAttachmentEffect: runtime.runAttachmentEffect,
  });
  registerExportHandlers({ runExportEffect: runtime.runExportEffect });
  registerGitHandlers({ runGitEffect: runtime.runGitEffect });
  registerDatabaseHandlers({
    runDatabaseEffect: runtime.runDatabaseEffect,
  });
  registerQuickCaptureHandlers({
    runQuickCaptureEffect: runtime.runQuickCaptureEffect,
  });
  registerJournalHandlers({
    runJournalEffect: runtime.runJournalEffect,
  });
  registerQuickNoteHandlers({
    runQuickNoteEffect: runtime.runQuickNoteEffect,
  });
  registerScratchHandlers({
    runScratchEffect: runtime.runScratchEffect,
  });
  registerSystemHandlers({ runSystemEffect: runtime.runSystemEffect });
  registerSettingsHandlers({
    runSettingsEffect: runtime.runSettingsEffect,
  });
  registerAIHandlers({
    runAIEffect: runtime.runAIEffect,
  });
  registerIndexHandlers({ runIndexEffect: runtime.runIndexEffect });
  registerMeetingHandlers({ runMeetingEffect: runtime.runMeetingEffect });
  registerTemplateHandlers({
    runTemplateEffect: runtime.runTemplateEffect,
  });
  registerDailyReviewHandlers({
    runDailyReviewEffect: runtime.runDailyReviewEffect,
  });
  registerStatusReportHandlers({
    runStatusReportEffect: runtime.runStatusReportEffect,
  });

  // Performance monitoring handlers
  const { perfMonitor } = runtime;
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
  // Function-based IPC handlers
  unregisterNoteHandlers();
  unregisterNotebookHandlers();
  unregisterWorkspaceHandlers();
  unregisterTagHandlers();
  unregisterSearchHandlers();
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
  unregisterDailyReviewHandlers();
  unregisterStatusReportHandlers();
  unregisterPerformanceHandlers();
}
