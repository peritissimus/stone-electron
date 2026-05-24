import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type {
  ISuggestTopicsUseCase,
  SuggestTopicsRequest,
  SuggestedTopic,
} from '../../../domain/ports/in/ITopicUseCases';
import { TopicSuggester, type SuggesterChunk } from '../../../domain/services/TopicSuggester';

/**
 * SuggestTopicsUseCase — runs the unsupervised topic suggester over the
 * active workspace's chunk index and returns clusters the user could adopt.
 *
 * Cheap on the back end: the suggester is pure math over vectors we already
 * have. The orchestration here is: load chunks, hydrate titles, run, return.
 */
export class SuggestTopicsUseCase implements ISuggestTopicsUseCase {
  constructor(
    private readonly indexRepository: IIndexRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly noteRepository: INoteRepository,
  ) {}

  async execute(request: SuggestTopicsRequest = {}): Promise<SuggestedTopic[]> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();
    if (!workspace) return [];

    const chunks = await this.indexRepository.getChunksForWorkspace(workspace.id);
    if (chunks.length === 0) return [];

    // Hydrate note titles in one batch — avoids N+1 inside the inner loop.
    const noteIds = Array.from(new Set(chunks.map((c) => c.noteId)));
    const titleByNoteId = new Map<string, string>();
    for (const noteId of noteIds) {
      const note = await this.noteRepository.findById(noteId);
      if (note) titleByNoteId.set(noteId, note.title || 'Untitled');
    }

    const suggesterChunks: SuggesterChunk[] = chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((c) => ({
        chunkId: c.id,
        noteId: c.noteId,
        noteTitle: titleByNoteId.get(c.noteId) ?? 'Untitled',
        headingPath: c.headingPath,
        text: c.text,
        embedding: c.embedding!,
      }));

    const clusters = TopicSuggester.suggest(suggesterChunks);

    return clusters.map((c) => ({
      id: c.id,
      label: c.label,
      altLabels: c.altLabels,
      noteIds: c.noteIds,
      chunkIds: c.chunkIds,
      noteCount: c.noteCount,
      chunkCount: c.chunkCount,
      cohesion: c.cohesion,
      representatives: c.representatives,
    }));
  }
}
