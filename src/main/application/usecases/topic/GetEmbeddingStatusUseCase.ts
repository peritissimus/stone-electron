import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  IGetEmbeddingStatusUseCase,
  EmbeddingStatus,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetEmbeddingStatusUseCase implements IGetEmbeddingStatusUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly embedder: IEmbedder,
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

    const notes = await this.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    let embeddedNotes = 0;

    for (const note of notes) {
      const embedding = await this.noteRepository.getEmbedding(note.id);
      if (embedding) embeddedNotes++;
    }

    return {
      ready: await this.embedder.isReady(),
      totalNotes: notes.length,
      embeddedNotes,
      pendingNotes: notes.length - embeddedNotes,
    };
  }
}
