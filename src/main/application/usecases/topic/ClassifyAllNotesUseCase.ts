import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  IClassifyAllNotesUseCase,
  IClassifyNoteUseCase,
  ClassifyAllResult,
} from '../../../domain/ports/in/ITopicUseCases';
import { DOMAIN_EVENT_TYPES } from '../../../domain/ports/out/IEventPublisher';
import { logger } from '../../../shared/utils';

export class ClassifyAllNotesUseCase implements IClassifyAllNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly topicRepository: ITopicRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly classifyNoteUseCase: IClassifyNoteUseCase,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(options?: {
    force?: boolean;
    excludeJournal?: boolean;
  }): Promise<ClassifyAllResult> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) return { processed: 0, total: 0, failed: 0 };

    const allNotes = await this.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });

    let notes = allNotes;
    if (options?.excludeJournal) {
      const config = await this.appConfigRepository.get();
      const journalPrefix = `${config.notes.locationPolicy.journalFolder}/`;
      const isJournal = (filePath: string | null | undefined) =>
        !!filePath?.startsWith(journalPrefix);
      notes = allNotes.filter((note) => !isJournal(note.filePath));
      // Strip stale assignments left over from a prior run that didn't filter.
      const journalNotes = allNotes.filter((note) => isJournal(note.filePath));
      for (const note of journalNotes) {
        await this.topicRepository.clearTopicsForNote(note.id);
      }
    }

    const total = notes.length;
    let processed = 0;
    let failed = 0;

    for (const note of notes) {
      try {
        await this.classifyNoteUseCase.execute(note.id, options?.force || false);
        processed++;
        this.eventPublisher?.publish({
          type: DOMAIN_EVENT_TYPES.EMBEDDING_PROGRESS,
          timestamp: new Date(),
          payload: {
            current: processed,
            total,
            failed,
          },
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
