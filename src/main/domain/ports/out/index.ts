/**
 * Outbound Ports Index (Secondary/Driven Ports)
 *
 * These interfaces define what the domain needs from the outside world.
 * Adapters implement these interfaces.
 */

export * from './INoteRepository';
export * from './INotebookRepository';
export * from './ITagRepository';
export * from './IWorkspaceRepository';
export * from './IFileStorage';
export * from './IMarkdownProcessor';
export * from './IEventPublisher';
export * from './IAttachmentRepository';
export * from './ITopicRepository';
export * from './IVersionRepository';
export * from './INoteLinkRepository';
export * from './ISearchEngine';
export * from './IEmbedder';
export * from './IExporter';
export * from './ISystemBridge';
export * from './IGitClient';
export * from './ISettingsRepository';
export * from './IAppConfigRepository';
export * from './IAIProviderKeyStore';
export * from './IFileWatcher';
export * from './IPerformanceMonitor';
export * from './IJournalReader';
export * from './IIdGenerator';
export * from './IPathService';
export * from './ITextGenerator';
export * from './IIndexRepository';
export * from './IReranker';
export * from './IMeetingRecordingRepository';
export * from './ITranscriber';
export * from './IEchoCanceller';
export * from './ISummarizationStrategy';
export * from './ITemplateRepository';
