import { Effect, Layer } from 'effect';
import type { Context } from 'effect';
import {
  AIProviderKeyStorePort,
  AppConfigRepositoryPort,
  AttachmentRepositoryPort,
  CalendarSourcePort,
  DatabaseManagerPort,
  EchoCancellerPort,
  EmbedderPort,
  EventPublisherPort,
  ExporterPort,
  ExternalSourceRegistryPort,
  FileStoragePort,
  FileWatcherPort,
  GitClientPort,
  GlobalShortcutRegistrarPort,
  IdGeneratorPort,
  IndexRepositoryPort,
  JobRepositoryPort,
  JournalReaderPort,
  LinearSourcePort,
  MailSourcePort,
  MarkdownProcessorPort,
  MeetingRecordingRepositoryPort,
  NoteLinkRepositoryPort,
  NoteRepositoryPort,
  NotebookRepositoryPort,
  PathServicePort,
  PerformanceMonitorPort,
  RerankerPort,
  SearchEnginePort,
  SettingsRepositoryPort,
  SummarizationStrategyPort,
  SystemBridgePort,
  TagRepositoryPort,
  TemplateRepositoryPort,
  TextGeneratorPort,
  TopicRepositoryPort,
  TranscriberPort,
  VersionRepositoryPort,
  WorkspaceRepositoryPort,
  type ISummarizationStrategy,
  type ITextGenerator,
  type ITranscriber,
} from '../../domain';

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Converts an adapter's Promise boundary into the native Effect service
 * exposed by its port. This stays inside adapters/out: application and
 * infrastructure consume only the named Layers below.
 */
function serviceOf<Service>(adapter: object): Service {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver) as unknown;
      if (typeof member !== 'function') return member;
      return (...args: unknown[]) =>
        Effect.tryPromise({
          try: () => Promise.resolve(Reflect.apply(member, target, args)),
          catch: asError,
        });
    },
  }) as Service;
}

type AdapterFor<Service> = {
  [Key in keyof Service]: Service[Key] extends (
    ...args: infer Args
  ) => Effect.Effect<infer Result, unknown>
    ? (...args: Args) => Result | Promise<Result>
    : Service[Key];
};

function defineLive<Identifier, Service>(
  tag: Context.Tag<Identifier, Service>,
): (adapter: AdapterFor<Service>) => Layer.Layer<Identifier> {
  return (adapter) => Layer.succeed(tag, serviceOf<Service>(adapter));
}

/** Connect interruption to the external operation, including callers' own signals. */
function cancellableRequest<Request extends { signal?: AbortSignal }, Result>(
  request: Request,
  run: (request: Request) => Promise<Result>,
): Effect.Effect<Result, Error> {
  return Effect.tryPromise({
    try: (signal) =>
      run({
        ...request,
        signal: request.signal ? AbortSignal.any([signal, request.signal]) : signal,
      }),
    catch: asError,
  });
}

export const AIProviderKeyStoreLive = defineLive(AIProviderKeyStorePort);
export const AppConfigRepositoryLive = defineLive(AppConfigRepositoryPort);
export const AttachmentRepositoryLive = defineLive(AttachmentRepositoryPort);
export const CalendarSourceLive = defineLive(CalendarSourcePort);
export const DatabaseManagerLive = defineLive(DatabaseManagerPort);
export const EchoCancellerLive = defineLive(EchoCancellerPort);
export const EmbedderLive = defineLive(EmbedderPort);
export const EventPublisherLive = defineLive(EventPublisherPort);
export const ExporterLive = defineLive(ExporterPort);
export const ExternalSourceRegistryLive = defineLive(ExternalSourceRegistryPort);
export const FileStorageLive = defineLive(FileStoragePort);
export const FileWatcherLive = defineLive(FileWatcherPort);
export const GitClientLive = defineLive(GitClientPort);
export const GlobalShortcutRegistrarLive = defineLive(GlobalShortcutRegistrarPort);
export const IdGeneratorLive = defineLive(IdGeneratorPort);
export const IndexRepositoryLive = defineLive(IndexRepositoryPort);
export const JobRepositoryLive = defineLive(JobRepositoryPort);
export const JournalReaderLive = defineLive(JournalReaderPort);
export const LinearSourceLive = defineLive(LinearSourcePort);
export const MailSourceLive = defineLive(MailSourcePort);
export const MarkdownProcessorLive = defineLive(MarkdownProcessorPort);
export const MeetingRecordingRepositoryLive = defineLive(MeetingRecordingRepositoryPort);
export const NoteLinkRepositoryLive = defineLive(NoteLinkRepositoryPort);
export const NoteRepositoryLive = defineLive(NoteRepositoryPort);
export const NotebookRepositoryLive = defineLive(NotebookRepositoryPort);
export const PathServiceLive = defineLive(PathServicePort);
export const PerformanceMonitorLive = defineLive(PerformanceMonitorPort);
export const RerankerLive = defineLive(RerankerPort);
export const SearchEngineLive = defineLive(SearchEnginePort);
export const SettingsRepositoryLive = defineLive(SettingsRepositoryPort);
export const SummarizationStrategyLive = (adapter: ISummarizationStrategy) =>
  Layer.succeed(SummarizationStrategyPort, {
    summarize: (request) => cancellableRequest(request, (input) => adapter.summarize(input)),
  });
export const SystemBridgeLive = defineLive(SystemBridgePort);
export const TagRepositoryLive = defineLive(TagRepositoryPort);
export const TemplateRepositoryLive = defineLive(TemplateRepositoryPort);
export const TextGeneratorLive = (adapter: ITextGenerator) =>
  Layer.succeed(TextGeneratorPort, {
    generateAnswer: (request) =>
      cancellableRequest(request, (input) => adapter.generateAnswer(input)),
    generateMarkdown: (request) =>
      cancellableRequest(request, (input) => adapter.generateMarkdown(input)),
    planQuery: (request) => cancellableRequest(request, (input) => adapter.planQuery(input)),
  });
export const TopicRepositoryLive = defineLive(TopicRepositoryPort);
export const TranscriberLive = (adapter: ITranscriber) =>
  Layer.succeed(TranscriberPort, {
    isReady: () => Effect.try({ try: () => adapter.isReady(), catch: asError }),
    initialize: () => Effect.tryPromise({ try: () => adapter.initialize(), catch: asError }),
    transcribe: (request) => cancellableRequest(request, (input) => adapter.transcribe(input)),
  });
export const VersionRepositoryLive = defineLive(VersionRepositoryPort);
export const WorkspaceRepositoryLive = defineLive(WorkspaceRepositoryPort);
