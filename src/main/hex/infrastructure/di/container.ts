/**
 * Application DI Container
 *
 * Wires all hexagonal architecture components using dependency injection.
 * This is the composition root where all dependencies are resolved.
 */

import type { Database } from '../database';

// Application Layer - Use Cases
import {
  createNoteUseCases,
  createNotebookUseCases,
  createWorkspaceUseCases,
  createTagUseCases,
  createSearchUseCases,
} from '../../application/usecases';

// Adapters - Outbound (Secondary) - Persistence
import {
  NoteRepository,
  NotebookRepository,
  WorkspaceRepository,
  TagRepository,
} from '../../adapters/out/persistence';

// Adapters - Outbound (Secondary) - Storage
import { FileSystemStorage } from '../../adapters/out/storage';

// Adapters - Outbound (Secondary) - Services
import {
  MarkdownProcessor,
  SearchEngine,
  EmbeddingServiceAdapter,
} from '../../adapters/out/services';

// Adapters - Outbound (Secondary) - External
import { GitOperations, EventPublisher } from '../../adapters/out/external';

// Adapters - Inbound (Primary) - IPC
import {
  NoteIPC,
  NotebookIPC,
  WorkspaceIPC,
  TagIPC,
  SearchIPC,
} from '../../adapters/in/ipc';

// Domain Ports (for type safety)
import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { INotebookRepository } from '../../domain/ports/out/INotebookRepository';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { ITagRepository } from '../../domain/ports/out/ITagRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';
import type { ISearchEngine } from '../../domain/ports/out/ISearchEngine';
import type { IEmbeddingService } from '../../domain/ports/out/IEmbeddingService';
import type { IGitOperations } from '../../domain/ports/out/IGitOperations';

// ============================================================================
// Container Types
// ============================================================================

export interface ContainerDeps {
  db: Database;
}

export interface Container {
  // Ports (interfaces)
  noteRepository: INoteRepository;
  notebookRepository: INotebookRepository;
  workspaceRepository: IWorkspaceRepository;
  tagRepository: ITagRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher: IEventPublisher;
  searchEngine: ISearchEngine;
  embeddingService: IEmbeddingService;
  gitOperations: IGitOperations;

  // Use Cases
  noteUseCases: ReturnType<typeof createNoteUseCases>;
  notebookUseCases: ReturnType<typeof createNotebookUseCases>;
  workspaceUseCases: ReturnType<typeof createWorkspaceUseCases>;
  tagUseCases: ReturnType<typeof createTagUseCases>;
  searchUseCases: ReturnType<typeof createSearchUseCases>;

  // IPC Adapters
  noteIPC: NoteIPC;
  notebookIPC: NotebookIPC;
  workspaceIPC: WorkspaceIPC;
  tagIPC: TagIPC;
  searchIPC: SearchIPC;

  // Helpers
  getWorkspacePath: () => string | null;
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
  const { db } = deps;

  // Helper function for workspace path
  const getWorkspacePath = () => activeWorkspacePath;

  // ---------------------------------------------------------------------------
  // Layer 1: Infrastructure Services (no dependencies)
  // ---------------------------------------------------------------------------
  const fileStorage: IFileStorage = new FileSystemStorage();
  const markdownProcessor: IMarkdownProcessor = new MarkdownProcessor();
  const eventPublisher: IEventPublisher = new EventPublisher();
  const gitOperations: IGitOperations = new GitOperations();

  // ---------------------------------------------------------------------------
  // Layer 2: Repositories (depend on db, some services)
  // ---------------------------------------------------------------------------
  const workspaceRepository: IWorkspaceRepository = new WorkspaceRepository({ db });
  const notebookRepository: INotebookRepository = new NotebookRepository({ db });
  const tagRepository: ITagRepository = new TagRepository({ db });

  const noteRepository: INoteRepository = new NoteRepository({
    db,
    fileStorage,
    markdownProcessor,
    getWorkspacePath,
  });

  // ---------------------------------------------------------------------------
  // Layer 3: Domain Services (depend on repositories)
  // ---------------------------------------------------------------------------
  const embeddingService: IEmbeddingService = new EmbeddingServiceAdapter({
    noteRepository,
    markdownProcessor,
  });

  const searchEngine: ISearchEngine = new SearchEngine({
    db,
    noteRepository,
    embeddingService,
  });

  // ---------------------------------------------------------------------------
  // Layer 4: Use Cases (depend on repositories and services)
  // ---------------------------------------------------------------------------
  const noteUseCases = createNoteUseCases(
    noteRepository,
    fileStorage,
    markdownProcessor
  );

  const notebookUseCases = createNotebookUseCases(notebookRepository);

  const workspaceUseCases = createWorkspaceUseCases(workspaceRepository);

  const tagUseCases = createTagUseCases(tagRepository);

  const searchUseCases = createSearchUseCases(
    noteRepository,
    searchEngine,
    embeddingService
  );

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
    // Ports
    noteRepository,
    notebookRepository,
    workspaceRepository,
    tagRepository,
    fileStorage,
    markdownProcessor,
    eventPublisher,
    searchEngine,
    embeddingService,
    gitOperations,

    // Use Cases
    noteUseCases,
    notebookUseCases,
    workspaceUseCases,
    tagUseCases,
    searchUseCases,

    // IPC Adapters
    noteIPC,
    notebookIPC,
    workspaceIPC,
    tagIPC,
    searchIPC,

    // Helpers
    getWorkspacePath,
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

  container.noteIPC.registerHandlers();
  container.notebookIPC.registerHandlers();
  container.workspaceIPC.registerHandlers();
  container.tagIPC.registerHandlers();
  container.searchIPC.registerHandlers();
}

export function unregisterIPCHandlers(): void {
  const container = getContainer();

  container.noteIPC.unregisterHandlers();
  container.notebookIPC.unregisterHandlers();
  container.workspaceIPC.unregisterHandlers();
  container.tagIPC.unregisterHandlers();
  container.searchIPC.unregisterHandlers();
}
