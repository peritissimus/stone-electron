import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import {
  DOMAIN_EVENT_TYPES,
  type IEventPublisher,
} from '../../../domain/ports/out/IEventPublisher';
import type {
  IClassifyNoteUseCase,
  ClassifyResult,
} from '../../../domain/ports/in/ITopicUseCases';
import type { IIndexNoteUseCase } from '../../../domain/ports/in/IIndexUseCases';
import { TopicClassifier, type TopicCandidate } from '../../../domain/services/TopicClassifier';

function decodeCentroid(centroid: Uint8Array): number[] {
  const float32 = new Float32Array(centroid.buffer, centroid.byteOffset, centroid.byteLength / 4);
  return Array.from(float32);
}

export class ClassifyNoteUseCase implements IClassifyNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly topicRepository: ITopicRepository,
    private readonly indexRepository: IIndexRepository,
    private readonly indexNote: IIndexNoteUseCase,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(noteId: string, force: boolean = false): Promise<ClassifyResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }
    if (!note.filePath || !note.workspaceId) {
      return { noteId, topics: [] };
    }

    // Ensure the note is chunk-indexed. IndexNoteUseCase is idempotent —
    // it short-circuits on content hash match unless `force` is true.
    const indexResult = await this.indexNote.execute({ noteId, force });
    if (indexResult.status === 'failed' || indexResult.status === 'missing') {
      return { noteId, topics: [] };
    }

    // The "note vector" is the mean of the note's chunk embeddings — same
    // shape (384 dims) as the legacy note.embedding, just sourced from the
    // canonical chunk index.
    const embedding = await this.indexRepository.getNoteVector(noteId);
    if (!embedding) {
      return { noteId, topics: [] };
    }

    const topics = await this.topicRepository.findAll();
    const candidates: TopicCandidate[] = topics
      .filter((topic): topic is typeof topic & { centroid: Uint8Array } => topic.centroid !== null)
      .map((topic) => ({
        topicId: topic.id,
        topicName: topic.name,
        centroid: decodeCentroid(topic.centroid),
      }));

    const matchedTopics = TopicClassifier.classify(embedding, candidates);

    // Drop stale auto-assignments before writing fresh ones; manual assignments
    // are preserved. Without this, a note that previously matched topic A and
    // now matches topic B would carry both indefinitely.
    await this.topicRepository.clearAutoTopicsForNote(noteId);

    for (const match of matchedTopics) {
      await this.topicRepository.assignToNote(noteId, match.topicId, {
        confidence: match.confidence,
      });
      this.eventPublisher?.publish({
        type: DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED,
        timestamp: new Date(),
        payload: {
          noteId,
          topicId: match.topicId,
          confidence: match.confidence,
        },
      });
    }

    return { noteId, topics: matchedTopics };
  }
}
