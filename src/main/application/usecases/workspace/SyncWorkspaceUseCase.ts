import {
  NoteEntity,
  type WorkspaceProps,
  type IWorkspaceRepository,
  type ISyncWorkspaceUseCase,
  type SyncWorkspaceRequest,
  type SyncWorkspaceResponse,
  type IIdGenerator,
  type IPathService,
  WorkspaceNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IIndexNoteUseCase } from '../../../domain/ports/in/IIndexUseCases';
import {
  WorkspaceDiffer,
  type DbEntry,
  type FsEntry,
} from '../../../domain/services/WorkspaceDiffer';
import { mapWithConcurrency } from '../../../domain/services/mapWithConcurrency';

/** Per-item work within each phase runs in parallel; keep modest — indexing hits a single embedder thread. */
const SYNC_CONCURRENCY = 4;

/** Outcome of processing a single entry within a sync phase. */
interface PhaseItemResult {
  createdDelta: number;
  updatedDelta: number;
  deletedDelta: number;
  embeddedDelta: number;
  error?: string;
}

const EMPTY_RESULT: PhaseItemResult = {
  createdDelta: 0,
  updatedDelta: 0,
  deletedDelta: 0,
  embeddedDelta: 0,
};

export class SyncWorkspaceUseCase implements ISyncWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly idGenerator: IIdGenerator,
    private readonly pathService: IPathService,
    private readonly indexNote?: IIndexNoteUseCase,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request?: SyncWorkspaceRequest): Promise<SyncWorkspaceResponse> {
    let workspace: WorkspaceProps | null;
    if (request?.workspaceId) {
      workspace = await this.workspaceRepository.findById(request.workspaceId);
      if (!workspace) {
        throw new WorkspaceNotFoundError(request.workspaceId);
      }
    } else {
      workspace = await this.workspaceRepository.findActive();
      if (!workspace) {
        throw new Error('No active workspace');
      }
    }

    // Load filesystem state (what .md files exist on disk).
    const markdownFiles = await this.fileStorage.glob('**/*.md', workspace.folderPath);
    const fsEntries: FsEntry[] = [];
    for (const relativePath of markdownFiles) {
      const absolutePath = this.pathService.join(workspace.folderPath, relativePath);
      const fileInfo = await this.fileStorage.getFileInfo(absolutePath);
      if (!fileInfo) continue;
      fsEntries.push({ relativePath, modifiedAt: fileInfo.modifiedAt });
    }

    // Load database state (what notes the DB knows about for this workspace).
    const existingNotes = await this.noteRepository.findAll({ workspaceId: workspace.id });
    const existingById = new Map(existingNotes.map((n) => [n.id, n]));
    const dbEntries: DbEntry[] = existingNotes.map((n) => ({
      id: n.id,
      filePath: n.filePath,
      updatedAt: n.updatedAt,
      isDeleted: n.isDeleted,
    }));

    // Pure diff: classify entries into added / modified / unchanged / removed.
    const plan = WorkspaceDiffer.diff(fsEntries, dbEntries);

    let created = 0;
    let updated = 0;
    let deleted = 0;
    let embedded = 0;
    const errors: string[] = [];

    // Act on `added` — create new note rows and delegate chunk-level indexing
    // to IndexNoteUseCase so they become searchable immediately (instead of
    // waiting for a manual reindex). Indexing errors are collected but don't
    // abort the sync — a later Reindex can fill any gaps.
    const addedResults = await mapWithConcurrency(
      plan.added,
      async (entry): Promise<PhaseItemResult> => {
        try {
          const absolutePath = this.pathService.join(workspace.folderPath, entry.relativePath);
          const fileContent = await this.fileStorage.read(absolutePath);

          // Extract title from content or derive from filename
          let title = fileContent ? this.markdownProcessor.extractTitle(fileContent) : null;
          if (!title) {
            title = this.pathService.basename(entry.relativePath, '.md');
          }

          const note = NoteEntity.create({
            id: this.idGenerator.generate(),
            title,
            filePath: entry.relativePath,
            workspaceId: workspace.id,
          });

          await this.noteRepository.save(note);
          this.eventPublisher?.publish({
            type: DOMAIN_EVENT_TYPES.NOTE_CREATED,
            timestamp: new Date(),
            payload: { id: note.id },
          });

          let embeddedDelta = 0;
          let error: string | undefined;
          if (this.indexNote) {
            try {
              const result = await this.indexNote.execute({ noteId: note.id });
              if (result.status === 'indexed' && result.chunkCount > 0) {
                embeddedDelta = 1;
              } else if (result.status === 'failed') {
                error = `Index failed for ${entry.relativePath}: ${result.error ?? 'unknown error'}`;
              }
            } catch (e) {
              error = `Index failed for ${entry.relativePath}: ${e instanceof Error ? e.message : 'unknown error'}`;
            }
          }

          return { ...EMPTY_RESULT, createdDelta: 1, embeddedDelta, error };
        } catch (e) {
          return {
            ...EMPTY_RESULT,
            error: `Add failed for ${entry.relativePath}: ${e instanceof Error ? e.message : 'unknown error'}`,
          };
        }
      },
      { concurrency: SYNC_CONCURRENCY },
    );
    for (const r of addedResults) {
      created += r.createdDelta;
      embedded += r.embeddedDelta;
      if (r.error) errors.push(r.error);
    }

    // Act on `modified` — refresh title and bump timestamp.
    const modifiedResults = await mapWithConcurrency(
      plan.modified,
      async (entry): Promise<PhaseItemResult> => {
        const existingNote = existingById.get(entry.dbId);
        if (!existingNote) return EMPTY_RESULT;

        try {
          const absolutePath = this.pathService.join(workspace.folderPath, entry.relativePath);
          const noteEntity = NoteEntity.fromPersistence(existingNote);

          // Re-extract title in case it changed
          const fileContent = await this.fileStorage.read(absolutePath);
          if (fileContent) {
            const newTitle = this.markdownProcessor.extractTitle(fileContent);
            if (newTitle && newTitle !== existingNote.title) {
              noteEntity.updateTitle(newTitle);
            }
          }

          // Force update timestamp
          if (existingNote.filePath) {
            noteEntity.updateFilePath(existingNote.filePath);
          }

          await this.noteRepository.save(noteEntity);
          this.eventPublisher?.publish({
            type: DOMAIN_EVENT_TYPES.NOTE_UPDATED,
            timestamp: new Date(),
            payload: { id: existingNote.id },
          });

          let error: string | undefined;
          // Re-index modified notes too. IndexNoteUseCase checks the content hash
          // and skips if the markdown body didn't actually change (e.g. mtime
          // changed but bytes didn't), so this is cheap on no-op edits.
          if (this.indexNote) {
            try {
              await this.indexNote.execute({ noteId: existingNote.id });
            } catch (e) {
              error = `Reindex failed for ${entry.relativePath}: ${e instanceof Error ? e.message : 'unknown error'}`;
            }
          }

          return { ...EMPTY_RESULT, updatedDelta: 1, error };
        } catch (e) {
          return {
            ...EMPTY_RESULT,
            error: `Modify failed for ${entry.relativePath}: ${e instanceof Error ? e.message : 'unknown error'}`,
          };
        }
      },
      { concurrency: SYNC_CONCURRENCY },
    );
    for (const r of modifiedResults) {
      updated += r.updatedDelta;
      if (r.error) errors.push(r.error);
    }

    // Act on `removed` — soft-delete notes whose files are gone.
    const removedResults = await mapWithConcurrency(
      plan.removed,
      async (entry): Promise<PhaseItemResult> => {
        const existingNote = existingById.get(entry.dbId);
        if (!existingNote) return EMPTY_RESULT;

        try {
          const noteEntity = NoteEntity.fromPersistence(existingNote);
          noteEntity.delete();

          await this.noteRepository.save(noteEntity);
          this.eventPublisher?.publish({
            type: DOMAIN_EVENT_TYPES.NOTE_DELETED,
            timestamp: new Date(),
            payload: { id: existingNote.id },
          });

          return { ...EMPTY_RESULT, deletedDelta: 1 };
        } catch (e) {
          return {
            ...EMPTY_RESULT,
            error: `Delete failed for ${existingNote.filePath ?? entry.dbId}: ${e instanceof Error ? e.message : 'unknown error'}`,
          };
        }
      },
      { concurrency: SYNC_CONCURRENCY },
    );
    for (const r of removedResults) {
      deleted += r.deletedDelta;
      if (r.error) errors.push(r.error);
    }

    return {
      workspaceId: workspace.id,
      notebooks: {
        created: 0,
        updated: 0,
        errors: [],
      },
      notes: { created, updated, deleted, embedded, errors },
    };
  }
}
