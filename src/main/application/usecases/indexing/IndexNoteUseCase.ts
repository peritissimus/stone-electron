import type {
  IIndexNoteUseCase,
  IndexNoteRequest,
  IndexNoteResponse,
} from '../../../domain/ports/in/IIndexUseCases';
import type {
  IEmbedder,
  IFileStorage,
  IIndexRepository,
  INoteRepository,
  IPathService,
  IWorkspaceRepository,
  NoteChunkRecord,
} from '../../../domain';
import { NoteChunker } from '../../../domain/services/NoteChunker';
import { hashText } from '../../../domain/services/hashText';

const EMBED_MODEL_NAME = 'Xenova/bge-small-en-v1.5';

export class IndexNoteUseCase implements IIndexNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly embedder: IEmbedder,
    private readonly indexRepository: IIndexRepository,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: IndexNoteRequest): Promise<IndexNoteResponse> {
    const note = await this.noteRepository.findById(request.noteId);
    if (!note || note.isDeleted) {
      return { noteId: request.noteId, status: 'missing', chunkCount: 0 };
    }
    if (!note.filePath || !note.workspaceId) {
      return { noteId: request.noteId, status: 'missing', chunkCount: 0 };
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      return { noteId: request.noteId, status: 'missing', chunkCount: 0 };
    }

    const absolutePath = this.pathService.join(workspace.folderPath, note.filePath);
    const markdown = await this.fileStorage.read(absolutePath);
    if (markdown === null) {
      await this.indexRepository.upsertStatus({
        noteId: note.id,
        workspaceId: workspace.id,
        contentHash: '',
        chunkCount: 0,
        indexedAt: null,
        model: null,
        dimensions: null,
        status: 'failed',
        error: 'file missing on disk',
      });
      return { noteId: note.id, status: 'failed', chunkCount: 0, error: 'file missing' };
    }

    const contentHash = hashText(markdown);
    const existing = await this.indexRepository.getStatus(note.id);
    if (!request.force && existing && existing.status === 'indexed' && existing.contentHash === contentHash) {
      return { noteId: note.id, status: 'skipped', chunkCount: existing.chunkCount };
    }

    const chunks = NoteChunker.chunk(note.id, markdown);
    if (chunks.length === 0) {
      // No indexable content. Wipe any previous chunks and mark indexed-with-zero.
      await this.indexRepository.replaceChunks(note.id, workspace.id, note.title ?? 'Untitled', []);
      await this.indexRepository.upsertStatus({
        noteId: note.id,
        workspaceId: workspace.id,
        contentHash,
        chunkCount: 0,
        indexedAt: new Date(),
        model: EMBED_MODEL_NAME,
        dimensions: null,
        status: 'indexed',
        error: null,
      });
      return { noteId: note.id, status: 'indexed', chunkCount: 0 };
    }

    if (!this.embedder.isReady()) {
      try {
        await this.embedder.initialize();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'embedder failed to initialize';
        await this.indexRepository.upsertStatus({
          noteId: note.id,
          workspaceId: workspace.id,
          contentHash,
          chunkCount: 0,
          indexedAt: null,
          model: EMBED_MODEL_NAME,
          dimensions: null,
          status: 'failed',
          error: message,
        });
        return { noteId: note.id, status: 'failed', chunkCount: 0, error: message };
      }
    }

    let vectors: Float32Array[];
    try {
      vectors = await this.embedder.generateEmbeddings(chunks.map((c) => c.text));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'embedding failed';
      await this.indexRepository.upsertStatus({
        noteId: note.id,
        workspaceId: workspace.id,
        contentHash,
        chunkCount: 0,
        indexedAt: null,
        model: EMBED_MODEL_NAME,
        dimensions: null,
        status: 'failed',
        error: message,
      });
      return { noteId: note.id, status: 'failed', chunkCount: 0, error: message };
    }

    if (vectors.length !== chunks.length) {
      const message = `embedding count mismatch (${vectors.length} vs ${chunks.length})`;
      await this.indexRepository.upsertStatus({
        noteId: note.id,
        workspaceId: workspace.id,
        contentHash,
        chunkCount: 0,
        indexedAt: null,
        model: EMBED_MODEL_NAME,
        dimensions: null,
        status: 'failed',
        error: message,
      });
      return { noteId: note.id, status: 'failed', chunkCount: 0, error: message };
    }

    const now = new Date();
    const records: NoteChunkRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      noteId: note.id,
      workspaceId: workspace.id,
      chunkIndex: chunk.index,
      headingPath: chunk.headingPath,
      text: chunk.text,
      contentHash: hashText(chunk.text),
      tokenCount: chunk.tokenCount,
      embedding: Array.from(vectors[i]),
      createdAt: now,
      updatedAt: now,
    }));

    await this.indexRepository.replaceChunks(
      note.id,
      workspace.id,
      note.title ?? 'Untitled',
      records,
    );
    await this.indexRepository.upsertStatus({
      noteId: note.id,
      workspaceId: workspace.id,
      contentHash,
      chunkCount: records.length,
      indexedAt: now,
      model: EMBED_MODEL_NAME,
      dimensions: vectors[0]?.length ?? null,
      status: 'indexed',
      error: null,
    });

    return { noteId: note.id, status: 'indexed', chunkCount: records.length };
  }
}
