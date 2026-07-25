/**
 * Effect-native outbound capability tags.
 *
 * EffectPort derives the executable service signature from the stable
 * outbound contract without duplicating every DTO. Concrete adapters expose
 * these services through named Layers in adapters/out/layers.ts.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { IAIProviderKeyStore } from './IAIProviderKeyStore';
import type { IAppConfigRepository } from './IAppConfigRepository';
import type { IAttachmentRepository } from './IAttachmentRepository';
import type { ICalendarSource } from './ICalendarSource';
import type { IDatabaseManager } from './IDatabaseManager';
import type { IEchoCanceller } from './IEchoCanceller';
import type { IEmbedder } from './IEmbedder';
import type { IEventPublisher } from './IEventPublisher';
import type { IExporter } from './IExporter';
import type { IExternalSource, IExternalSourceRegistry } from './IExternalSource';
import type { IFileStorage } from './IFileStorage';
import type { IFileWatcher } from './IFileWatcher';
import type { IGitClient } from './IGitClient';
import type { IGlobalShortcutRegistrar } from './IGlobalShortcutRegistrar';
import type { IIdGenerator } from './IIdGenerator';
import type { IIndexRepository } from './IIndexRepository';
import type { IJobRepository } from './IJobRepository';
import type { IJournalReader } from './IJournalReader';
import type { ILinearSource } from './ILinearSource';
import type { IMailSource } from './IMailSource';
import type { IMarkdownProcessor } from './IMarkdownProcessor';
import type { IMeetingRecordingRepository } from './IMeetingRecordingRepository';
import type { INoteLinkRepository } from './INoteLinkRepository';
import type { INoteRepository } from './INoteRepository';
import type { INotebookRepository } from './INotebookRepository';
import type { IPathService } from './IPathService';
import type { IPerformanceMonitor } from './IPerformanceMonitor';
import type { IReranker } from './IReranker';
import type { ISearchEngine } from './ISearchEngine';
import type { ISettingsRepository } from './ISettingsRepository';
import type { ISummarizationStrategy } from './ISummarizationStrategy';
import type { ISystemBridge } from './ISystemBridge';
import type { ITagRepository } from './ITagRepository';
import type { ITemplateRepository } from './ITemplateRepository';
import type { ITextGenerator } from './ITextGenerator';
import type { ITopicRepository } from './ITopicRepository';
import type { ITranscriber } from './ITranscriber';
import type { IVersionRepository } from './IVersionRepository';
import type { IWorkspaceRepository } from './IWorkspaceRepository';

type EffectMethod<T> = T extends (...args: infer Args) => infer Result
  ? (
      ...args: Args
    ) => Effect.Effect<
      Awaited<Result>,
      Error
    >
  : T;

export type EffectPort<T> = {
  readonly [Key in keyof T]: EffectMethod<T[Key]>;
};

export const AIProviderKeyStorePort =
  Context.GenericTag<EffectPort<IAIProviderKeyStore>>('stone/IAIProviderKeyStore');
export const AppConfigRepositoryPort =
  Context.GenericTag<EffectPort<IAppConfigRepository>>('stone/IAppConfigRepository');
export const AttachmentRepositoryPort =
  Context.GenericTag<EffectPort<IAttachmentRepository>>('stone/IAttachmentRepository');
export const CalendarSourcePort =
  Context.GenericTag<EffectPort<ICalendarSource>>('stone/ICalendarSource');
export const DatabaseManagerPort =
  Context.GenericTag<EffectPort<IDatabaseManager>>('stone/IDatabaseManager');
export const EchoCancellerPort =
  Context.GenericTag<EffectPort<IEchoCanceller>>('stone/IEchoCanceller');
export const EmbedderPort = Context.GenericTag<EffectPort<IEmbedder>>('stone/IEmbedder');
export const EventPublisherPort =
  Context.GenericTag<EffectPort<IEventPublisher>>('stone/IEventPublisher');
export const ExporterPort = Context.GenericTag<EffectPort<IExporter>>('stone/IExporter');
export const ExternalSourcePort =
  Context.GenericTag<EffectPort<IExternalSource>>('stone/IExternalSource');
export const ExternalSourceRegistryPort =
  Context.GenericTag<EffectPort<IExternalSourceRegistry>>('stone/IExternalSourceRegistry');
export const FileStoragePort =
  Context.GenericTag<EffectPort<IFileStorage>>('stone/IFileStorage');
export const FileWatcherPort =
  Context.GenericTag<EffectPort<IFileWatcher>>('stone/IFileWatcher');
export const GitClientPort = Context.GenericTag<EffectPort<IGitClient>>('stone/IGitClient');
export const GlobalShortcutRegistrarPort =
  Context.GenericTag<EffectPort<IGlobalShortcutRegistrar>>('stone/IGlobalShortcutRegistrar');
export const IdGeneratorPort =
  Context.GenericTag<EffectPort<IIdGenerator>>('stone/IIdGenerator');
export const IndexRepositoryPort =
  Context.GenericTag<EffectPort<IIndexRepository>>('stone/IIndexRepository');
export const JobRepositoryPort =
  Context.GenericTag<EffectPort<IJobRepository>>('stone/IJobRepository');
export const JournalReaderPort =
  Context.GenericTag<EffectPort<IJournalReader>>('stone/IJournalReader');
export const LinearSourcePort =
  Context.GenericTag<EffectPort<ILinearSource>>('stone/ILinearSource');
export const MailSourcePort = Context.GenericTag<EffectPort<IMailSource>>('stone/IMailSource');
export const MarkdownProcessorPort =
  Context.GenericTag<EffectPort<IMarkdownProcessor>>('stone/IMarkdownProcessor');
export const MeetingRecordingRepositoryPort =
  Context.GenericTag<EffectPort<IMeetingRecordingRepository>>(
    'stone/IMeetingRecordingRepository',
  );
export const NoteLinkRepositoryPort =
  Context.GenericTag<EffectPort<INoteLinkRepository>>('stone/INoteLinkRepository');
export const NoteRepositoryPort =
  Context.GenericTag<EffectPort<INoteRepository>>('stone/INoteRepository');
export const NotebookRepositoryPort =
  Context.GenericTag<EffectPort<INotebookRepository>>('stone/INotebookRepository');
export const PathServicePort =
  Context.GenericTag<EffectPort<IPathService>>('stone/IPathService');
export const PerformanceMonitorPort =
  Context.GenericTag<EffectPort<IPerformanceMonitor>>('stone/IPerformanceMonitor');
export const RerankerPort = Context.GenericTag<EffectPort<IReranker>>('stone/IReranker');
export const SearchEnginePort =
  Context.GenericTag<EffectPort<ISearchEngine>>('stone/ISearchEngine');
export const SettingsRepositoryPort =
  Context.GenericTag<EffectPort<ISettingsRepository>>('stone/ISettingsRepository');
export const SummarizationStrategyPort =
  Context.GenericTag<EffectPort<ISummarizationStrategy>>('stone/ISummarizationStrategy');
export const SystemBridgePort =
  Context.GenericTag<EffectPort<ISystemBridge>>('stone/ISystemBridge');
export const TagRepositoryPort =
  Context.GenericTag<EffectPort<ITagRepository>>('stone/ITagRepository');
export const TemplateRepositoryPort =
  Context.GenericTag<EffectPort<ITemplateRepository>>('stone/ITemplateRepository');
export const TextGeneratorPort =
  Context.GenericTag<EffectPort<ITextGenerator>>('stone/ITextGenerator');
export const TopicRepositoryPort =
  Context.GenericTag<EffectPort<ITopicRepository>>('stone/ITopicRepository');
export const TranscriberPort =
  Context.GenericTag<EffectPort<ITranscriber>>('stone/ITranscriber');
export const VersionRepositoryPort =
  Context.GenericTag<EffectPort<IVersionRepository>>('stone/IVersionRepository');
export const WorkspaceRepositoryPort =
  Context.GenericTag<EffectPort<IWorkspaceRepository>>('stone/IWorkspaceRepository');
