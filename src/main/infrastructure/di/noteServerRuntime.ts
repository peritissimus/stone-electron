import path from 'node:path';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import {
  AIUseCasesPort,
  AttachmentUseCasesPort,
  DatabaseUseCasesPort,
  ExportUseCasesPort,
  GitUseCasesPort,
  IndexUseCasesPort,
  SearchUseCasesPort,
  TopicUseCasesPort,
  WorkspaceActivationPort,
  WorkspaceUseCasesPort,
  QuickCaptureUseCasesPort,
  DailyReviewUseCasesPort,
  MeetingUseCasesPort,
  GraphUseCasesPort,
  JournalUseCasesPort,
  NotebookUseCasesPort,
  NoteUseCasesPort,
  QuickNoteUseCasesPort,
  SettingsUseCasesPort,
  StatusReportUseCasesPort,
  TagUseCasesPort,
  TaskUseCasesPort,
  TemplateUseCasesPort,
  VersionUseCasesPort,
  WorkspaceEntity,
  type IAIUseCases,
  type IAttachmentUseCases,
  type IDatabaseManager,
  type IDatabaseUseCases,
  type IIndexUseCases,
  type ISearchUseCases,
  type ITopicUseCases,
  type IWorkspaceUseCases,
  type IQuickCaptureUseCases,
  type IDailyReviewUseCases,
  type IMeetingUseCases,
  type IExportUseCases,
  type IGitUseCases,
  type IGraphUseCases,
  type IJournalUseCases,
  type INotebookUseCases,
  type INoteUseCases,
  type IQuickNoteUseCases,
  type ISettingsUseCases,
  type IStatusReportUseCases,
  type ITagUseCases,
  type ITaskUseCases,
  type ITemplateUseCases,
  type IVersionUseCases,
  type WorkspaceProps,
  type IEventPublisher,
  type IPerformanceMonitor,
} from '../../domain';
import { NoteUseCasesLive } from '../../application/usecases/note/noteUseCases';
import { NotebookUseCasesLive } from '../../application/usecases/notebook/notebookUseCases';
import { TagUseCasesLive } from '../../application/usecases/tag/tagUseCases';
import { TaskUseCasesLive } from '../../application/usecases/task/taskUseCases';
import { GraphUseCasesLive } from '../../application/usecases/graph/graphUseCases';
import { JournalUseCasesLive } from '../../application/usecases/journal/journalUseCases';
import { VersionUseCasesLive } from '../../application/usecases/version/versionUseCases';
import { AttachmentUseCasesLive } from '../../application/usecases/attachment/attachmentUseCases';
import { QuickNoteUseCasesLive } from '../../application/usecases/quickNote/quickNoteUseCases';
import { SettingsUseCasesLive } from '../../application/usecases/settings/settingsUseCases';
import { GitUseCasesLive } from '../../application/usecases/git/gitUseCases';
import { DatabaseUseCasesLive } from '../../application/usecases/database/databaseUseCases';
import { TemplateUseCasesLive } from '../../application/usecases/template/templateUseCases';
import { ExportUseCasesLive } from '../../application/usecases/export/exportUseCases';
import { StatusReportUseCasesLive } from '../../application/usecases/statusReport/statusReportUseCases';
import { WorkspaceUseCasesLive } from '../../application/usecases/workspace/workspaceUseCases';
import { QuickCaptureUseCasesLive } from '../../application/usecases/quickCapture/quickCaptureUseCases';
import { WhisperCppTranscriber } from '../../adapters/out/integrations/WhisperCppTranscriber';
import { DailyReviewUseCasesLive } from '../../application/usecases/dailyReview/dailyReviewUseCases';
import {
  MeetingUseCasesLive,
  MEETING_FINALIZE_JOB,
} from '../../application/usecases/meeting/meetingUseCases';
import { createMeetingFinalizeJobHandler } from '../workers/meetingFinalizeJob';
import { SingleShotSummarizer } from '../../adapters/out/integrations/SingleShotSummarizer';
import { OnnxEchoCanceller } from '../../adapters/out/integrations/OnnxEchoCanceller';
import { JobRepository } from '../../adapters/out/persistence/JobRepository';
import { PerformanceMonitor } from '../../adapters/out/integrations/PerformanceMonitor';
import { JobRunner } from '../workers/JobRunner';
import { WhisperServer } from '../workers/WhisperServer';
import { ServerCalendarSource } from '../../adapters/out/integrations/ServerCalendarSource';
import { ExternalSourceRegistry } from '../../adapters/out/integrations/ExternalSourceRegistry';
import { SystemBridge } from '../../adapters/out/integrations/SystemBridge';
import { TEMPLATE_STARTER_PACK } from '../seed/templateStarterPack';
import { IndexUseCasesLive } from '../../application/usecases/indexing/indexUseCases';
import { TopicUseCasesLive } from '../../application/usecases/topic/topicUseCases';
import { SearchUseCasesLive } from '../../application/usecases/search/searchUseCases';
import { AIUseCasesLive } from '../../application/usecases/ai/aiUseCases';
import { TopicRepository } from '../../adapters/out/persistence/TopicRepository';
import { IndexRepository } from '../../adapters/out/persistence/IndexRepository';
import { SearchEngine } from '../../adapters/out/integrations/SearchEngine';
import { Embedder } from '../../adapters/out/integrations/Embedder';
import { LocalReranker } from '../../adapters/out/integrations/LocalReranker';
import { createEmbeddingWorker } from '../workers/EmbeddingWorker';
import { GitClient } from '../../adapters/out/integrations/GitClient';
import { Exporter } from '../../adapters/out/integrations/Exporter';
import { AISDKTextGenerator } from '../../adapters/out/integrations/AISDKTextGenerator';
import { FileSystemTemplateRepository } from '../../adapters/out/persistence/FileSystemTemplateRepository';
import { MeetingRecordingRepository } from '../../adapters/out/persistence/MeetingRecordingRepository';
import { NoteRepository } from '../../adapters/out/persistence/NoteRepository';
import { NotebookRepository } from '../../adapters/out/persistence/NotebookRepository';
import { TagRepository } from '../../adapters/out/persistence/TagRepository';
import { NoteLinkRepository } from '../../adapters/out/persistence/NoteLinkRepository';
import { VersionRepository } from '../../adapters/out/persistence/VersionRepository';
import { JournalReader } from '../../adapters/out/persistence/JournalReader';
import { AttachmentRepository } from '../../adapters/out/persistence/AttachmentRepository';
import { SettingsRepository } from '../../adapters/out/persistence/SettingsRepository';
import { ServerAIProviderKeyStore } from '../../adapters/out/persistence/ServerAIProviderKeyStore';
import { WorkspaceRepository } from '../../adapters/out/persistence/WorkspaceRepository';
import { AppConfigRepository } from '../../adapters/out/persistence/AppConfigRepository';
import { FileSystemStorage } from '../../adapters/out/storage/FileSystemStorage';
import { MarkdownProcessor } from '../../adapters/out/integrations/MarkdownProcessor';
import { CryptoIdGenerator } from '../../adapters/out/integrations/CryptoIdGenerator';
import { NodePathService } from '../../adapters/out/integrations/NodePathService';
import { ServerEventPublisher } from '../../adapters/out/events/ServerEventPublisher';
import { ServerGlobalShortcutRegistrar } from '../../adapters/out/integrations/ServerGlobalShortcutRegistrar';
import {
  AIProviderKeyStoreLive,
  AppConfigRepositoryLive,
  AttachmentRepositoryLive,
  CalendarSourceLive,
  EchoCancellerLive,
  JobRepositoryLive,
  PerformanceMonitorLive,
  SummarizationStrategyLive,
  DatabaseManagerLive,
  EmbedderLive,
  EventPublisherLive,
  ExporterLive,
  ExternalSourceRegistryLive,
  FileStorageLive,
  GitClientLive,
  GlobalShortcutRegistrarLive,
  IdGeneratorLive,
  IndexRepositoryLive,
  JournalReaderLive,
  MarkdownProcessorLive,
  MeetingRecordingRepositoryLive,
  RerankerLive,
  SearchEngineLive,
  SystemBridgeLive,
  TemplateRepositoryLive,
  TranscriberLive,
  TextGeneratorLive,
  TopicRepositoryLive,
  NoteLinkRepositoryLive,
  NoteRepositoryLive,
  NotebookRepositoryLive,
  PathServiceLive,
  SettingsRepositoryLive,
  TagRepositoryLive,
  VersionRepositoryLive,
  WorkspaceRepositoryLive,
} from '../../adapters/out/layers';
import type { Database } from '../../shared';

export type RunNoteEffect = <A, E>(
  use: (service: INoteUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunNotebookEffect = <A, E>(
  use: (service: INotebookUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunTagEffect = <A, E>(
  use: (service: ITagUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunTaskEffect = <A, E>(
  use: (service: ITaskUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunGraphEffect = <A, E>(
  use: (service: IGraphUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunVersionEffect = <A, E>(
  use: (service: IVersionUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunJournalEffect = <A, E>(
  use: (service: IJournalUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunAttachmentEffect = <A, E>(
  use: (service: IAttachmentUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunQuickNoteEffect = <A, E>(
  use: (service: IQuickNoteUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunSettingsEffect = <A, E>(
  use: (service: ISettingsUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunGitEffect = <A, E>(use: (service: IGitUseCases) => Effect.Effect<A, E>) => Promise<A>;

export type RunDatabaseEffect = <A, E>(
  use: (service: IDatabaseUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunTemplateEffect = <A, E>(
  use: (service: ITemplateUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunExportEffect = <A, E>(
  use: (service: IExportUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunStatusReportEffect = <A, E>(
  use: (service: IStatusReportUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunIndexEffect = <A, E>(
  use: (service: IIndexUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunTopicEffect = <A, E>(
  use: (service: ITopicUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunSearchEffect = <A, E>(
  use: (service: ISearchUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunAIEffect = <A, E>(use: (service: IAIUseCases) => Effect.Effect<A, E>) => Promise<A>;

export type RunWorkspaceEffect = <A, E>(
  use: (service: IWorkspaceUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunQuickCaptureEffect = <A, E>(
  use: (service: IQuickCaptureUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunDailyReviewEffect = <A, E>(
  use: (service: IDailyReviewUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export type RunMeetingEffect = <A, E>(
  use: (service: IMeetingUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export interface NoteServerRuntime {
  workspace: WorkspaceProps;
  performanceMonitor: IPerformanceMonitor;
  /** Domain events, for the SSE stream that replaces webContents.send. */
  eventPublisher: IEventPublisher;
  runNoteEffect: RunNoteEffect;
  runNotebookEffect: RunNotebookEffect;
  runTagEffect: RunTagEffect;
  runTaskEffect: RunTaskEffect;
  runGraphEffect: RunGraphEffect;
  runVersionEffect: RunVersionEffect;
  runJournalEffect: RunJournalEffect;
  runAttachmentEffect: RunAttachmentEffect;
  runQuickNoteEffect: RunQuickNoteEffect;
  runSettingsEffect: RunSettingsEffect;
  runGitEffect: RunGitEffect;
  runDatabaseEffect: RunDatabaseEffect;
  runTemplateEffect: RunTemplateEffect;
  runExportEffect: RunExportEffect;
  runStatusReportEffect: RunStatusReportEffect;
  runIndexEffect: RunIndexEffect;
  runTopicEffect: RunTopicEffect;
  runSearchEffect: RunSearchEffect;
  runAIEffect: RunAIEffect;
  runWorkspaceEffect: RunWorkspaceEffect;
  runQuickCaptureEffect: RunQuickCaptureEffect;
  runDailyReviewEffect: RunDailyReviewEffect;
  runMeetingEffect: RunMeetingEffect;
  dispose: () => Promise<void>;
}

export interface NoteServerRuntimeDeps {
  db: Database;
  /** The already-initialized manager, so db:* reports on the live connection. */
  databaseManager: IDatabaseManager;
  workspacePath: string;
  configPath: string;
  /** Where the embedding model is cached. */
  mlCacheDir: string;
  /** Absolute path to the built embedding.worker.cjs, when not beside __dirname. */
  embeddingWorkerPath?: string;
  /** Directory holding the ggml whisper models. */
  whisperModelDir: string;
  /** Path to the bundled whisper binary. */
  whisperBinaryPath?: string;
  /** Path to the resident whisper-server binary used for live transcripts. */
  whisperServerBinaryPath?: string;
}

async function ensureActiveWorkspace(
  repository: WorkspaceRepository,
  fileStorage: FileSystemStorage,
  idGenerator: CryptoIdGenerator,
  workspacePath: string,
): Promise<WorkspaceProps> {
  await fileStorage.createDirectory(workspacePath);

  const configured = await repository.findByFolderPath(workspacePath);
  if (configured) {
    await repository.setActive(configured.id);
    return { ...configured, isActive: true };
  }

  const workspace = WorkspaceEntity.create({
    id: idGenerator.generate(),
    name: path.basename(workspacePath) || 'Stone',
    folderPath: workspacePath,
    isActive: true,
  });
  await repository.save(workspace);
  await repository.setActive(workspace.id);
  return workspace.toPersistence();
}

/**
 * Composes only the capabilities required by the notes HTTP server.
 *
 * Importing the desktop runtime here would initialize Electron IPC, native
 * integrations, recording workers, and global shortcuts in a headless process.
 */
export async function createNoteServerRuntime(
  deps: NoteServerRuntimeDeps,
): Promise<NoteServerRuntime> {
  const workspacePath = path.resolve(deps.workspacePath);
  const fileStorage = new FileSystemStorage();
  const markdownProcessor = new MarkdownProcessor();
  const eventPublisher = new ServerEventPublisher();
  const idGenerator = new CryptoIdGenerator();
  const pathService = new NodePathService();
  const workspaceRepository = new WorkspaceRepository({ db: deps.db });
  const appConfigRepository = new AppConfigRepository({
    configPath: path.resolve(deps.configPath),
  });
  const noteRepository = new NoteRepository({
    db: deps.db,
    fileStorage,
    getWorkspacePath: () => workspacePath,
  });
  const notebookRepository = new NotebookRepository({ db: deps.db });
  const tagRepository = new TagRepository({ db: deps.db });
  const noteLinkRepository = new NoteLinkRepository({ db: deps.db });
  const versionRepository = new VersionRepository({ db: deps.db });
  const journalReader = new JournalReader({ db: deps.db, fileStorage });
  const attachmentRepository = new AttachmentRepository({ db: deps.db });
  const settingsRepository = new SettingsRepository({ db: deps.db });
  const configDirectory = path.dirname(path.resolve(deps.configPath));
  const aiProviderKeyStore = new ServerAIProviderKeyStore(
    path.join(configDirectory, 'ai-provider-keys.json'),
    path.join(configDirectory, '.credential-key'),
  );
  const shortcutRegistrar = new ServerGlobalShortcutRegistrar();
  const gitClient = new GitClient();
  const meetingRecordingRepository = new MeetingRecordingRepository({ db: deps.db });
  const templateRepository = new FileSystemTemplateRepository({
    fileStorage,
    workspaceRepository,
    markdownProcessor,
    pathService,
  });
  // PDF rendering needs a Chromium; headless, `isPdfAvailable()` reports false
  // and the browser prints locally instead.
  const exporter = new Exporter();
  const textGenerator = new AISDKTextGenerator({
    appConfigRepository,
    aiProviderKeyStore,
    runPromise: Effect.runPromise,
  });
  const topicRepository = new TopicRepository({ db: deps.db });
  const indexRepository = new IndexRepository({ db: deps.db });
  const searchEngine = new SearchEngine({ db: deps.db, noteRepository });
  // The ML worker is plain Node; outside Electron it needs the cache and bundle
  // locations passed in explicitly.
  const embeddingWorker = createEmbeddingWorker({
    cacheDir: deps.mlCacheDir,
    ...(deps.embeddingWorkerPath ? { workerPath: deps.embeddingWorkerPath } : {}),
    // No renderer windows to notify, and supplying this keeps the worker from
    // probing for an Electron runtime that is not here.
    statusSink: { setServiceStatus: () => {}, broadcastModelDownloadProgress: () => {} },
  });
  const embedder = new Embedder({ workerService: embeddingWorker });
  const reranker = new LocalReranker({ workerService: embeddingWorker });
  // Only its path helpers are reachable here; the dialog methods need Electron
  // and are never called on the folder-operation paths.
  const systemBridge = new SystemBridge();
  const calendarSource = new ServerCalendarSource();
  const summarizer = new SingleShotSummarizer({ textGenerator });
  // Best-effort: echo cancellation needs ONNX models and only matters when a
  // system-audio track exists, which browser capture does not produce.
  const echoCanceller = new OnnxEchoCanceller();
  const jobRepository = new JobRepository({ db: deps.db });
  // Reports on the server process — the machine actually doing the work.
  const performanceMonitor = new PerformanceMonitor({ runFork: Effect.runFork });
  performanceMonitor.startMonitoring();
  const jobRunner = new JobRunner({ repository: jobRepository, idGenerator });
  // Resident whisper-server process backing the live transcript draft.
  const liveTranscriber = new WhisperServer({
    modelDir: deps.whisperModelDir,
    ...(deps.whisperServerBinaryPath ? { binary: deps.whisperServerBinaryPath } : {}),
  });
  // No external sources are reachable from the server process yet; the registry
  // still has to exist for the daily review to compose.
  const externalSourceRegistry = new ExternalSourceRegistry({
    sources: [],
    appConfigRepository,
  });
  // Whisper runs as a bundled binary over local model files; both locations
  // must be explicit here because there is no Electron userData to infer from.
  const transcriber = new WhisperCppTranscriber({
    modelDir: deps.whisperModelDir,
    ...(deps.whisperBinaryPath ? { binary: deps.whisperBinaryPath } : {}),
  });

  const workspace = await ensureActiveWorkspace(
    workspaceRepository,
    fileStorage,
    idGenerator,
    workspacePath,
  );

  const workers = Layer.mergeAll(
    JobRunner.layer(jobRunner),
    WhisperServer.layer(liveTranscriber),
  );
  const adapters = Layer.mergeAll(
    AIProviderKeyStoreLive(aiProviderKeyStore),
    AppConfigRepositoryLive(appConfigRepository),
    AttachmentRepositoryLive(attachmentRepository),
    DatabaseManagerLive(deps.databaseManager),
    EmbedderLive(embedder),
    EventPublisherLive(eventPublisher),
    IndexRepositoryLive(indexRepository),
    RerankerLive(reranker),
    SearchEngineLive(searchEngine),
    TopicRepositoryLive(topicRepository),
    ExporterLive(exporter),
    FileStorageLive(fileStorage),
    GitClientLive(gitClient),
    IdGeneratorLive(idGenerator),
    GlobalShortcutRegistrarLive(shortcutRegistrar),
    MeetingRecordingRepositoryLive(meetingRecordingRepository),
    CalendarSourceLive(calendarSource),
    EchoCancellerLive(echoCanceller),
    JobRepositoryLive(jobRepository),
    PerformanceMonitorLive(performanceMonitor),
    SummarizationStrategyLive(summarizer),
    ExternalSourceRegistryLive(externalSourceRegistry),
    SystemBridgeLive(systemBridge),
    TranscriberLive(transcriber),
    TemplateRepositoryLive(templateRepository),
    TextGeneratorLive(textGenerator),
    Layer.succeed(WorkspaceActivationPort, {
      afterActivated: (workspaceId: string) =>
        Effect.tryPromise({
          try: () => templateRepository.seedDefaultsIfEmpty(workspaceId, TEMPLATE_STARTER_PACK),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }),
    }),
    JournalReaderLive(journalReader),
    MarkdownProcessorLive(markdownProcessor),
    NoteLinkRepositoryLive(noteLinkRepository),
    NoteRepositoryLive(noteRepository),
    NotebookRepositoryLive(notebookRepository),
    PathServiceLive(pathService),
    SettingsRepositoryLive(settingsRepository),
    TagRepositoryLive(tagRepository),
    VersionRepositoryLive(versionRepository),
    WorkspaceRepositoryLive(workspaceRepository),
  );
  const coreUseCases = Layer.mergeAll(
    NoteUseCasesLive,
    NotebookUseCasesLive,
    TagUseCasesLive,
    TaskUseCasesLive,
    GraphUseCasesLive,
    JournalUseCasesLive,
    VersionUseCasesLive,
    AttachmentUseCasesLive,
    SettingsUseCasesLive,
    GitUseCasesLive,
    DatabaseUseCasesLive,
    ExportUseCasesLive,
    IndexUseCasesLive,
    SearchUseCasesLive,
  ).pipe(Layer.provide(adapters));
  // These depend on other IN ports, so they compose on top of coreUseCases.
  const composedUseCases = Layer.mergeAll(
    QuickNoteUseCasesLive,
    TemplateUseCasesLive,
    StatusReportUseCasesLive,
    TopicUseCasesLive,
    AIUseCasesLive,
    WorkspaceUseCasesLive,
    QuickCaptureUseCasesLive,
  ).pipe(Layer.provide(coreUseCases), Layer.provide(adapters));
  // Meetings need quick capture (send-to-journal) plus the worker layers.
  const meetingLayer = MeetingUseCasesLive.pipe(
    Layer.provide(Layer.merge(coreUseCases, composedUseCases)),
    Layer.provide(workers),
    Layer.provide(adapters),
  );
  // Daily review consumes quick capture, so it layers on top of that group.
  const dailyReviewLayer = DailyReviewUseCasesLive.pipe(
    Layer.provide(Layer.merge(coreUseCases, composedUseCases)),
    Layer.provide(adapters),
  );
  const useCases = Layer.mergeAll(coreUseCases, composedUseCases, dailyReviewLayer, meetingLayer);
  const runtime = ManagedRuntime.make(useCases);

  const runNoteEffect: RunNoteEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      NoteUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runNotebookEffect: RunNotebookEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      NotebookUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTagEffect: RunTagEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      TagUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTaskEffect: RunTaskEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      TaskUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runGraphEffect: RunGraphEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      GraphUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runVersionEffect: RunVersionEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      VersionUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runJournalEffect: RunJournalEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      JournalUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runAttachmentEffect: RunAttachmentEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      AttachmentUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runQuickNoteEffect: RunQuickNoteEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      QuickNoteUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runSettingsEffect: RunSettingsEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      SettingsUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runGitEffect: RunGitEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      GitUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runDatabaseEffect: RunDatabaseEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      DatabaseUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTemplateEffect: RunTemplateEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      TemplateUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runExportEffect: RunExportEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      ExportUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runStatusReportEffect: RunStatusReportEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      StatusReportUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runIndexEffect: RunIndexEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      IndexUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runTopicEffect: RunTopicEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      TopicUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runSearchEffect: RunSearchEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      SearchUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };
  const runAIEffect: RunAIEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      AIUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runWorkspaceEffect: RunWorkspaceEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      WorkspaceUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runQuickCaptureEffect: RunQuickCaptureEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      QuickCaptureUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runDailyReviewEffect: RunDailyReviewEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      DailyReviewUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  const runMeetingEffect: RunMeetingEffect = async (use) => {
    const exit = await runtime.runPromiseExit(
      MeetingUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  };

  // Finalize runs asynchronously off the job queue; progress reaches clients as
  // meeting:statusChanged events rather than in the enqueue response.
  jobRunner.register(
    MEETING_FINALIZE_JOB,
    createMeetingFinalizeJobHandler(async (finalizeRequest, signal) => {
      await runMeetingEffect((service) =>
        service.finalizeRecording.execute(finalizeRequest, { signal }).pipe(Effect.asVoid),
      );
    }),
  );

  return {
    workspace,
    performanceMonitor,
    eventPublisher,
    runNoteEffect,
    runNotebookEffect,
    runTagEffect,
    runTaskEffect,
    runGraphEffect,
    runVersionEffect,
    runJournalEffect,
    runAttachmentEffect,
    runQuickNoteEffect,
    runSettingsEffect,
    runGitEffect,
    runDatabaseEffect,
    runTemplateEffect,
    runExportEffect,
    runStatusReportEffect,
    runIndexEffect,
    runTopicEffect,
    runSearchEffect,
    runAIEffect,
    runWorkspaceEffect,
    runQuickCaptureEffect,
    runDailyReviewEffect,
    runMeetingEffect,
    dispose: () => runtime.dispose(),
  };
}
