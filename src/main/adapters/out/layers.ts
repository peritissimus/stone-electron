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

function defineLive<Identifier, Service>(
  tag: Context.Tag<Identifier, Service>,
): (adapter: object) => Layer.Layer<Identifier> {
  return (adapter) => Layer.succeed(tag, serviceOf<Service>(adapter));
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
export const MeetingRecordingRepositoryLive = defineLive(
  MeetingRecordingRepositoryPort,
);
export const NoteLinkRepositoryLive = defineLive(NoteLinkRepositoryPort);
export const NoteRepositoryLive = defineLive(NoteRepositoryPort);
export const NotebookRepositoryLive = defineLive(NotebookRepositoryPort);
export const PathServiceLive = defineLive(PathServicePort);
export const PerformanceMonitorLive = defineLive(PerformanceMonitorPort);
export const RerankerLive = defineLive(RerankerPort);
export const SearchEngineLive = defineLive(SearchEnginePort);
export const SettingsRepositoryLive = defineLive(SettingsRepositoryPort);
export const SummarizationStrategyLive = defineLive(SummarizationStrategyPort);
export const SystemBridgeLive = defineLive(SystemBridgePort);
export const TagRepositoryLive = defineLive(TagRepositoryPort);
export const TemplateRepositoryLive = defineLive(TemplateRepositoryPort);
export const TextGeneratorLive = defineLive(TextGeneratorPort);
export const TopicRepositoryLive = defineLive(TopicRepositoryPort);
export const TranscriberLive = defineLive(TranscriberPort);
export const VersionRepositoryLive = defineLive(VersionRepositoryPort);
export const WorkspaceRepositoryLive = defineLive(WorkspaceRepositoryPort);
