import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type {
  ITopicSemanticSearchUseCase,
  TopicSimilarNote,
} from '../../../domain/ports/in/ITopicUseCases';

export class TopicSemanticSearchUseCase implements ITopicSemanticSearchUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly embedder: IEmbedder,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(query: string, limit: number = 10): Promise<TopicSimilarNote[]> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) return [];

    const queryVec = await this.embedder.generateEmbedding(query);
    const similar = await this.indexRepository.findSimilarNotesByVector(Array.from(queryVec), {
      limit,
      workspaceId: activeWorkspace.id,
    });

    return similar.map((s) => ({
      noteId: s.noteId,
      title: s.title,
      distance: s.similarity,
    }));
  }
}
