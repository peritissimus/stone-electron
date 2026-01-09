/**
 * Topic Use Cases - ML-based topic classification
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEmbeddingService } from '../../../domain/ports/out/IEmbeddingService';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ITopicUseCases } from '../../../domain/ports/in/ITopicUseCases';
import { SimilarityCalculator } from '../../../domain/services/SimilarityCalculator';
import { TopicEntity } from '../../../domain/entities/Topic';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared/utils';
import path from 'node:path';
import crypto from 'node:crypto';

export interface TopicUseCasesDeps {
  noteRepository: INoteRepository;
  topicRepository: ITopicRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  embeddingService: IEmbeddingService;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher?: IEventPublisher;
}

export interface TopicDTO {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPredefined: boolean;
  noteCount: number;
}

export interface ClassifyResult {
  noteId: string;
  topicId: string | null;
  confidence: number;
}

export interface SimilarNote {
  noteId: string;
  noteTitle: string;
  similarity: number;
}

/**
 * Topic Use Cases implementation
 */
class TopicUseCasesImpl implements ITopicUseCases {
  constructor(private deps: TopicUseCasesDeps) {}

  async initialize(): Promise<void> {
    await this.deps.embeddingService.initialize();
    logger.info('[TopicUseCases] Embedding service initialized');
  }

  async getAllTopics(): Promise<TopicDTO[]> {
    const topicsWithCounts = await this.deps.topicRepository.findAllWithCounts();

    return topicsWithCounts.map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount: topic.noteCount,
    }));
  }

  async getTopicById(id: string): Promise<TopicDTO | null> {
    const topic = await this.deps.topicRepository.findById(id);
    if (!topic) return null;

    const notesForTopic = await this.deps.topicRepository.getNotesForTopic(id);
    const noteCount = notesForTopic.length;

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount,
    };
  }

  async createTopic(data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<TopicDTO> {
    const topic = TopicEntity.create({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description || '',
      color: data.color || '#6366f1',
      isPredefined: false,
    });

    await this.deps.topicRepository.save(topic);

    this.deps.eventPublisher?.emit(EVENTS.TOPIC_CREATED, { topic: topic.toPersistence() });

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount: 0,
    };
  }

  async updateTopic(
    id: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<TopicDTO> {
    const topicProps = await this.deps.topicRepository.findById(id);
    if (!topicProps) {
      throw new Error(`Topic not found: ${id}`);
    }

    // Reconstruct entity from props
    const topic = TopicEntity.fromPersistence(topicProps);

    if (data.name) topic.rename(data.name);
    if (data.description !== undefined) topic.updateDescription(data.description);
    if (data.color) topic.changeColor(data.color);

    await this.deps.topicRepository.save(topic);

    this.deps.eventPublisher?.emit(EVENTS.TOPIC_UPDATED, { topic: topic.toPersistence() });

    const notesForTopic = await this.deps.topicRepository.getNotesForTopic(id);
    const noteCount = notesForTopic.length;

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount,
    };
  }

  async deleteTopic(id: string): Promise<void> {
    const topic = await this.deps.topicRepository.findById(id);
    if (!topic) {
      throw new Error(`Topic not found: ${id}`);
    }

    if (topic.isPredefined) {
      throw new Error('Cannot delete predefined topics');
    }

    await this.deps.topicRepository.delete(id);

    this.deps.eventPublisher?.emit(EVENTS.TOPIC_DELETED, { id });

    logger.info(`[TopicUseCases] Deleted topic ${id}`);
  }

  async classifyNote(noteId: string, force: boolean = false): Promise<ClassifyResult> {
    const {
      noteRepository,
      topicRepository,
      workspaceRepository,
      fileStorage,
      embeddingService,
      markdownProcessor,
    } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Check if already has embedding
    const existingEmbedding = await noteRepository.getEmbedding(noteId);
    if (existingEmbedding && !force) {
      return { noteId, topicId: null, confidence: 0 };
    }

    // Get note content
    if (!note.filePath || !note.workspaceId) {
      return { noteId, topicId: null, confidence: 0 };
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      return { noteId, topicId: null, confidence: 0 };
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      return { noteId, topicId: null, confidence: 0 };
    }

    // Convert to plain text and generate embedding
    const plainText = await markdownProcessor.extractPlainText(markdown);
    const embeddingFloat32 = await embeddingService.generateEmbedding(plainText);
    const embedding = Array.from(embeddingFloat32);

    // Save embedding
    await noteRepository.updateEmbedding(noteId, embedding);

    // Find best matching topic
    const topics = await topicRepository.findAll();
    let bestTopic: { id: string; confidence: number } | null = null;

    for (const topic of topics) {
      if (topic.centroid) {
        // Convert Uint8Array centroid back to Float32Array then to number[]
        const centroidFloat32 = new Float32Array(
          topic.centroid.buffer,
          topic.centroid.byteOffset,
          topic.centroid.byteLength / 4,
        );
        const similarity = SimilarityCalculator.cosineSimilarity(
          embedding,
          Array.from(centroidFloat32),
        );
        if (!bestTopic || similarity > bestTopic.confidence) {
          bestTopic = { id: topic.id, confidence: similarity };
        }
      }
    }

    // Assign topic if confidence is high enough
    if (bestTopic && bestTopic.confidence > 0.5) {
      await topicRepository.assignToNote(noteId, bestTopic.id, {
        confidence: bestTopic.confidence,
      });

      this.deps.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
        noteId,
        topicId: bestTopic.id,
        confidence: bestTopic.confidence,
      });

      return { noteId, topicId: bestTopic.id, confidence: bestTopic.confidence };
    }

    return { noteId, topicId: null, confidence: bestTopic?.confidence || 0 };
  }

  async classifyAllNotes(options?: {
    force?: boolean;
  }): Promise<{ processed: number; classified: number }> {
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) return { processed: 0, classified: 0 };

    const notes = await this.deps.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    const total = notes.length;
    let processed = 0;
    let classified = 0;

    for (const note of notes) {
      try {
        const result = await this.classifyNote(note.id, options?.force || false);
        processed++;
        if (result.topicId) classified++;

        // Emit progress event
        this.deps.eventPublisher?.emit(EVENTS.EMBEDDING_PROGRESS, {
          current: processed,
          total,
          classified,
        });
      } catch (error) {
        logger.error(`[TopicUseCases] Failed to classify note ${note.id}:`, error);
      }
    }

    logger.info(`[TopicUseCases] Classified ${classified}/${processed} notes`);
    return { processed, classified };
  }

  async assignTopicToNote(noteId: string, topicId: string): Promise<void> {
    await this.deps.topicRepository.assignToNote(noteId, topicId, {
      confidence: 1.0,
      isManual: true,
    });

    this.deps.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
      noteId,
      topicId,
      confidence: 1.0,
      isManual: true,
    });

    logger.info(`[TopicUseCases] Assigned topic ${topicId} to note ${noteId}`);
  }

  async removeTopicFromNote(noteId: string, topicId: string): Promise<void> {
    await this.deps.topicRepository.removeFromNote(noteId, topicId);

    this.deps.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
      noteId,
      topicId: null,
      removed: true,
    });

    logger.info(`[TopicUseCases] Removed topic ${topicId} from note ${noteId}`);
  }

  async getSimilarNotes(noteId: string, limit: number = 10): Promise<SimilarNote[]> {
    const note = await this.deps.noteRepository.findById(noteId);
    if (!note) return [];

    const embedding = await this.deps.noteRepository.getEmbedding(noteId);
    if (!embedding) {
      return [];
    }

    const similarNotes = await this.deps.noteRepository.findBySimilarity(
      embedding,
      limit + 1,
      note.workspaceId || undefined,
    );

    // Filter out the query note and map to result
    // distance is typically 0-2 for cosine, convert to similarity (1 - distance/2)
    const results: SimilarNote[] = [];
    for (const result of similarNotes) {
      if (result.noteId !== noteId) {
        const note = await this.deps.noteRepository.findById(result.noteId);
        if (note) {
          results.push({
            noteId: result.noteId,
            noteTitle: note.title || 'Untitled',
            similarity: 1 - result.distance / 2, // Convert distance to similarity
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  async semanticSearch(query: string, limit: number = 10): Promise<SimilarNote[]> {
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) return [];

    const embeddingFloat32 = await this.deps.embeddingService.generateEmbedding(query);
    const embedding = Array.from(embeddingFloat32);
    const results = await this.deps.noteRepository.findBySimilarity(
      embedding,
      limit,
      activeWorkspace.id,
    );

    const notes: SimilarNote[] = [];
    for (const result of results) {
      const note = await this.deps.noteRepository.findById(result.noteId);
      if (note) {
        notes.push({
          noteId: result.noteId,
          noteTitle: note.title || 'Untitled',
          similarity: 1 - result.distance / 2, // Convert distance to similarity
        });
      }
    }

    return notes;
  }

  async recomputeCentroids(): Promise<void> {
    const topics = await this.deps.topicRepository.findAll();

    for (const topicProps of topics) {
      const notesForTopic = await this.deps.topicRepository.getNotesForTopic(topicProps.id);
      const noteIds = notesForTopic.map((n) => n.noteId);
      const embeddings: number[][] = [];

      for (const noteId of noteIds) {
        const embedding = await this.deps.noteRepository.getEmbedding(noteId);
        if (embedding) {
          embeddings.push(embedding);
        }
      }

      if (embeddings.length > 0) {
        const centroid = SimilarityCalculator.calculateCentroid(embeddings);
        await this.deps.topicRepository.updateCentroid(
          topicProps.id,
          new Uint8Array(new Float32Array(centroid).buffer),
        );
      }
    }

    logger.info('[TopicUseCases] Recomputed all topic centroids');
  }

  async getEmbeddingStatus(): Promise<{
    totalNotes: number;
    notesWithEmbeddings: number;
    isReady: boolean;
  }> {
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) {
      return {
        totalNotes: 0,
        notesWithEmbeddings: 0,
        isReady: await this.deps.embeddingService.isReady(),
      };
    }

    const notes = await this.deps.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    let withEmbeddings = 0;

    for (const note of notes) {
      const embedding = await this.deps.noteRepository.getEmbedding(note.id);
      if (embedding) withEmbeddings++;
    }

    return {
      totalNotes: notes.length,
      notesWithEmbeddings: withEmbeddings,
      isReady: await this.deps.embeddingService.isReady(),
    };
  }

  async getNotesForTopic(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<
    Array<{
      noteId: string;
      confidence: number;
      isManual: boolean;
    }>
  > {
    const notesForTopic = await this.deps.topicRepository.getNotesForTopic(topicId, options);
    return notesForTopic;
  }

  async getTopicsForNote(noteId: string): Promise<
    Array<{
      noteId: string;
      topicId: string;
      confidence: number;
      isManual: boolean;
      createdAt: Date;
      topicName: string;
      topicColor: string;
    }>
  > {
    const topicsForNote = await this.deps.topicRepository.getTopicsForNote(noteId);
    return topicsForNote;
  }
}

export function createTopicUseCases(deps: TopicUseCasesDeps): ITopicUseCases {
  return new TopicUseCasesImpl(deps);
}
