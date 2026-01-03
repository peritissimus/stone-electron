/**
 * Awilix DI Container
 *
 * Centralized dependency injection for the API layer.
 * All services and repositories are registered here with proper DI.
 */

import { createContainer, asFunction, asClass, InjectionMode } from 'awilix';

// Database
import { getDatabaseManager } from '../database';

// Repositories
import {
  NoteRepository,
  NotebookRepository,
  TagRepository,
  WorkspaceRepository,
  AttachmentRepository,
  VersionRepository,
  TopicRepository,
  NoteLinkRepository,
} from '../repositories';

// Services
import { NoteService, createNoteService } from '../services/NoteService';
import { NotebookService, createNotebookService } from '../services/NotebookService';
import { TagService, createTagService } from '../services/TagService';
import { WorkspaceService, createWorkspaceService } from '../services/WorkspaceService';
import { SearchService, createSearchService } from '../services/SearchService';
import { FileSystemService, createFileSystemService } from '../services/FileSystemService';
import { FileWatcherService, createFileWatcherService } from '../services/FileWatcherService';
import { MarkdownService, createMarkdownService } from '../services/MarkdownService';
import { TopicService, createTopicService } from '../services/TopicService';
import { EventBus, createEventBus } from '../services/EventBus';
import { EmbeddingService, createEmbeddingService } from '../services/EmbeddingService';
import { GraphService, createGraphService } from '../services/GraphService';
import { TaskService, createTaskService } from '../services/TaskService';
import { ExportService, createExportService } from '../services/ExportService';

// Types for the container
export interface Container {
  // Infrastructure
  db: ReturnType<typeof getDatabaseManager>;
  eventBus: EventBus;
  markdownService: MarkdownService;
  embeddingService: EmbeddingService;
  fileSystemService: FileSystemService;
  fileWatcherService: FileWatcherService;
  topicService: TopicService;

  // Repositories
  noteRepository: NoteRepository;
  notebookRepository: NotebookRepository;
  tagRepository: TagRepository;
  workspaceRepository: WorkspaceRepository;
  attachmentRepository: AttachmentRepository;
  versionRepository: VersionRepository;
  topicRepository: TopicRepository;
  noteLinkRepository: NoteLinkRepository;

  // Services
  noteService: NoteService;
  notebookService: NotebookService;
  tagService: TagService;
  workspaceService: WorkspaceService;
  searchService: SearchService;
  graphService: GraphService;
  taskService: TaskService;
  exportService: ExportService;
}

/**
 * Create and configure the DI container
 */
export function createAppContainer() {
  const container = createContainer<Container>({
    injectionMode: InjectionMode.PROXY,
  });

  // Register infrastructure (order matters - dependencies first)
  container.register({
    // Core infrastructure (no dependencies)
    db: asFunction(() => getDatabaseManager()).singleton(),
    eventBus: asFunction(() => createEventBus()).singleton(),
    markdownService: asFunction(() => createMarkdownService()).singleton(),
    embeddingService: asFunction(() => createEmbeddingService()).singleton(),

    // FileSystemService (depends on markdownService)
    fileSystemService: asFunction((cradle) =>
      createFileSystemService({
        markdownService: cradle.markdownService,
      }),
    ).singleton(),
  });

  // Register repositories
  container.register({
    noteRepository: asClass(NoteRepository).singleton(),
    notebookRepository: asClass(NotebookRepository).singleton(),
    tagRepository: asClass(TagRepository).singleton(),
    workspaceRepository: asClass(WorkspaceRepository).singleton(),
    attachmentRepository: asClass(AttachmentRepository).singleton(),
    versionRepository: asClass(VersionRepository).singleton(),
    topicRepository: asClass(TopicRepository).singleton(),
    noteLinkRepository: asClass(NoteLinkRepository).singleton(),
  });

  // Register infrastructure services that depend on repositories
  container.register({
    // FileWatcherService (depends on repositories + eventBus)
    fileWatcherService: asFunction((cradle) =>
      createFileWatcherService({
        workspaceRepository: cradle.workspaceRepository,
        noteRepository: cradle.noteRepository,
        notebookRepository: cradle.notebookRepository,
        eventBus: cradle.eventBus,
      }),
    ).singleton(),

    // TopicService (depends on repositories + services)
    topicService: asFunction((cradle) =>
      createTopicService({
        topicRepository: cradle.topicRepository,
        noteRepository: cradle.noteRepository,
        embeddingService: cradle.embeddingService,
        markdownService: cradle.markdownService,
      }),
    ).singleton(),
  });

  // Register business services with proper DI
  container.register({
    // NoteService
    noteService: asFunction((cradle) =>
      createNoteService({
        noteRepository: cradle.noteRepository,
        workspaceRepository: cradle.workspaceRepository,
        notebookRepository: cradle.notebookRepository,
        tagRepository: cradle.tagRepository,
        fileSystemService: cradle.fileSystemService,
        markdownService: cradle.markdownService,
        eventBus: cradle.eventBus,
      }),
    ).singleton(),

    // NotebookService
    notebookService: asFunction((cradle) =>
      createNotebookService({
        notebookRepository: cradle.notebookRepository,
        eventBus: cradle.eventBus,
      }),
    ).singleton(),

    // TagService
    tagService: asFunction((cradle) =>
      createTagService({
        tagRepository: cradle.tagRepository,
        noteRepository: cradle.noteRepository,
        eventBus: cradle.eventBus,
      }),
    ).singleton(),

    // WorkspaceService
    workspaceService: asFunction((cradle) =>
      createWorkspaceService({
        workspaceRepository: cradle.workspaceRepository,
        notebookRepository: cradle.notebookRepository,
        noteRepository: cradle.noteRepository,
        fileSystemService: cradle.fileSystemService,
        fileWatcherService: cradle.fileWatcherService,
        eventBus: cradle.eventBus,
      }),
    ).singleton(),

    // SearchService
    searchService: asFunction((cradle) =>
      createSearchService({
        noteRepository: cradle.noteRepository,
        noteService: cradle.noteService,
        topicService: cradle.topicService,
      }),
    ).singleton(),

    // GraphService
    graphService: asFunction((cradle) =>
      createGraphService({
        noteRepository: cradle.noteRepository,
      }),
    ).singleton(),

    // ExportService
    exportService: asFunction((cradle) =>
      createExportService({
        noteService: cradle.noteService,
      }),
    ).singleton(),

    // TaskService
    taskService: asFunction((cradle) =>
      createTaskService({
        noteRepository: cradle.noteRepository,
        workspaceRepository: cradle.workspaceRepository,
        noteService: cradle.noteService,
      }),
    ).singleton(),
  });

  return container;
}

// Singleton container instance
let containerInstance: ReturnType<typeof createAppContainer> | null = null;

/**
 * Get or create the container instance
 */
export function getContainer() {
  if (!containerInstance) {
    containerInstance = createAppContainer();
  }
  return containerInstance;
}

/**
 * Reset container (useful for testing)
 */
export function resetContainer() {
  if (containerInstance) {
    containerInstance.dispose();
    containerInstance = null;
  }
}
