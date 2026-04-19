import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  ITopicSemanticSearchUseCase,
  TopicSimilarNote,
} from '../../../domain/ports/in/ITopicUseCases';

export class TopicSemanticSearchUseCase implements ITopicSemanticSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly embedder: IEmbedder,
  ) {}

  async execute(query: string, limit: number = 10): Promise<TopicSimilarNote[]> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) return [];

    const embeddingFloat32 = await this.embedder.generateEmbedding(query);
    const embedding = Array.from(embeddingFloat32);
    const results = await this.noteRepository.findBySimilarity(
      embedding,
      limit,
      activeWorkspace.id,
    );

    const notes: TopicSimilarNote[] = [];
    for (const result of results) {
      const note = await this.noteRepository.findById(result.noteId);
      if (note) {
        notes.push({
          noteId: result.noteId,
          title: note.title || 'Untitled',
          distance: result.distance,
        });
      }
    }

    return notes;
  }
}
