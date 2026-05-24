import type {
  IAdoptSuggestedTopicUseCase,
  AdoptSuggestedTopicRequest,
  AdoptSuggestedTopicResponse,
  ICreateTopicUseCase,
  IAssignTopicToNoteUseCase,
  IRecomputeCentroidsUseCase,
} from '../../../domain/ports/in/ITopicUseCases';

const DEFAULT_COLOR = '#6366f1';

/**
 * AdoptSuggestedTopicUseCase — turns a suggester cluster into a real topic.
 *
 * Composes: create the topic record, assign each member note as a manual
 * assignment (so the suggester won't re-propose them unprompted later),
 * then trigger a centroid recompute so the new topic immediately
 * participates in future classification.
 */
export class AdoptSuggestedTopicUseCase implements IAdoptSuggestedTopicUseCase {
  constructor(
    private readonly createTopic: ICreateTopicUseCase,
    private readonly assignTopic: IAssignTopicToNoteUseCase,
    private readonly recomputeCentroids: IRecomputeCentroidsUseCase,
  ) {}

  async execute(request: AdoptSuggestedTopicRequest): Promise<AdoptSuggestedTopicResponse> {
    const name = request.name.trim();
    if (!name) throw new Error('Adopt suggested topic: name is required');
    if (request.noteIds.length === 0) {
      throw new Error('Adopt suggested topic: at least one note is required');
    }

    const topic = await this.createTopic.execute({
      name,
      color: request.color ?? DEFAULT_COLOR,
    });

    let assigned = 0;
    for (const noteId of request.noteIds) {
      await this.assignTopic.execute(noteId, topic.id);
      assigned += 1;
    }

    await this.recomputeCentroids.execute();

    return {
      topicId: topic.id,
      assignedNoteCount: assigned,
    };
  }
}
