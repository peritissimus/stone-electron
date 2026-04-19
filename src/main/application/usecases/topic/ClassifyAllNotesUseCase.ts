import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  IClassifyAllNotesUseCase,
  IClassifyNoteUseCase,
  ClassifyAllResult,
} from '../../../domain/ports/in/ITopicUseCases';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared/utils';

export class ClassifyAllNotesUseCase implements IClassifyAllNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly classifyNoteUseCase: IClassifyNoteUseCase,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(options?: { force?: boolean }): Promise<ClassifyAllResult> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) return { processed: 0, total: 0, failed: 0 };

    const notes = await this.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    const total = notes.length;
    let processed = 0;
    let failed = 0;

    for (const note of notes) {
      try {
        await this.classifyNoteUseCase.execute(note.id, options?.force || false);
        processed++;
        this.eventPublisher?.emit(EVENTS.EMBEDDING_PROGRESS, {
          current: processed,
          total,
          failed,
        });
      } catch (error) {
        failed++;
        logger.error(`[TopicUseCases] Failed to classify note ${note.id}:`, error);
      }
    }

    logger.info(`[TopicUseCases] Classified ${processed}/${total} notes (${failed} failed)`);
    return { processed, total, failed };
  }
}
