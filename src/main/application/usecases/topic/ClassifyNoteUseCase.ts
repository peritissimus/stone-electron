import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import {
  DOMAIN_EVENT_TYPES,
  type IEventPublisher,
} from '../../../domain/ports/out/IEventPublisher';
import type {
  IClassifyNoteUseCase,
  ClassifyResult,
} from '../../../domain/ports/in/ITopicUseCases';
import { TopicClassifier, type TopicCandidate } from '../../../domain/services/TopicClassifier';

function decodeCentroid(centroid: Uint8Array): number[] {
  const float32 = new Float32Array(centroid.buffer, centroid.byteOffset, centroid.byteLength / 4);
  return Array.from(float32);
}

export class ClassifyNoteUseCase implements IClassifyNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly topicRepository: ITopicRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly embedder: IEmbedder,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly pathService: IPathService,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(noteId: string, force: boolean = false): Promise<ClassifyResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const existingEmbedding = await this.noteRepository.getEmbedding(noteId);
    if (existingEmbedding && !force) {
      return { noteId, topics: [] };
    }

    if (!note.filePath || !note.workspaceId) {
      return { noteId, topics: [] };
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      return { noteId, topics: [] };
    }

    const absolutePath = this.pathService.join(workspace.folderPath, note.filePath);
    const markdown = await this.fileStorage.read(absolutePath);
    if (!markdown) {
      return { noteId, topics: [] };
    }

    const plainText = await this.markdownProcessor.extractPlainText(markdown);
    const embeddingFloat32 = await this.embedder.generateEmbedding(plainText);
    const embedding = Array.from(embeddingFloat32);

    await this.noteRepository.updateEmbedding(noteId, embedding);

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
