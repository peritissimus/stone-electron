import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type {
  IGetEmbeddingStatusUseCase,
  EmbeddingStatus,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetEmbeddingStatusUseCase implements IGetEmbeddingStatusUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly embedder: IEmbedder,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(): Promise<EmbeddingStatus> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      return {
        ready: await this.embedder.isReady(),
        totalNotes: 0,
        embeddedNotes: 0,
        pendingNotes: 0,
      };
    }

    // "Embedded" now means "has at least one indexed chunk". The chunk index
    // is the canonical source of retrieval truth; legacy note.embedding is
    // gone.
    const stats = await this.indexRepository.getWorkspaceStats(activeWorkspace.id);
    return {
      ready: await this.embedder.isReady(),
      totalNotes: stats.totalNotes,
      embeddedNotes: stats.indexedNotes,
      pendingNotes: stats.pendingNotes,
    };
  }
}
