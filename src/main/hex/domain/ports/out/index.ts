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
export * from './IGitOperations';
export * from './IEmbeddingService';
