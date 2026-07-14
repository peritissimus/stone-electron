import type {
  IIndexNoteUseCase,
  IRebuildAllNotesIndexUseCase,
  RebuildAllNotesIndexRequest,
  RebuildAllNotesIndexResponse,
} from '../../../domain/ports/in/IIndexUseCases';
import { type INoteRepository, type IWorkspaceRepository, mapWithConcurrency } from '../../../domain';

/** Notes are processed in parallel; the embedder is a single worker thread, so keep this modest. */
const REBUILD_CONCURRENCY = 4;

type IndexOutcome = 'indexed' | 'skipped' | 'failed' | 'missing';

export class RebuildAllNotesIndexUseCase implements IRebuildAllNotesIndexUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly indexNote: IIndexNoteUseCase,
  ) {}

  async execute(
    request: RebuildAllNotesIndexRequest = {},
  ): Promise<RebuildAllNotesIndexResponse> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();
    if (!workspace) {
      return { workspaceId: '', total: 0, indexed: 0, skipped: 0, failed: 0, missing: 0 };
    }

    const allNotes = await this.noteRepository.findAll({
      workspaceId: workspace.id,
      isDeleted: false,
    });

    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let missing = 0;

    // Process notes in parallel (modest concurrency — the embedder is a single
    // worker thread). Each worker isolates its own errors so one bad note never
    // aborts the whole rebuild; a thrown/failed indexNote counts as `failed`,
    // matching the previous switch behavior.
    const outcomes = await mapWithConcurrency(
      allNotes,
      async (note): Promise<IndexOutcome> => {
        try {
          const result = await this.indexNote.execute({
            noteId: note.id,
            force: request.force ?? false,
          });
          return result.status;
        } catch {
          return 'failed';
        }
      },
      { concurrency: REBUILD_CONCURRENCY },
    );

    for (const status of outcomes) {
      switch (status) {
        case 'indexed':
          indexed += 1;
          break;
        case 'skipped':
          skipped += 1;
          break;
        case 'failed':
          failed += 1;
          break;
        case 'missing':
          missing += 1;
          break;
      }
    }

    return {
      workspaceId: workspace.id,
      total: allNotes.length,
      indexed,
      skipped,
      failed,
      missing,
    };
  }
}
