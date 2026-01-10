/**
 * Topic Use Cases - ML-based topic classification
 */

import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { IEmbeddingService } from '../../domain/ports/out/IEmbeddingService';
import type { IMarkdownProcessor } from '../../domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';
import type { ITopicUseCases } from '../../domain/ports/in/ITopicUseCases';
import { SimilarityCalculator } from '../../domain/services/SimilarityCalculator';
import { TopicEntity } from '../../domain/entities/Topic';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../shared/utils';
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
  topics: Array<{
    topicId: string;
    topicName: string;
    confidence: number;
  }>;
}

export interface SimilarNote {
  noteId: string;
  title: string;
  distance: number;
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
      return { noteId, topics: [] };
    }

    // Get note content
    if (!note.filePath || !note.workspaceId) {
      return { noteId, topics: [] };
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      return { noteId, topics: [] };
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      return { noteId, topics: [] };
    }

    // Convert to plain text and generate embedding
    const plainText = await markdownProcessor.extractPlainText(markdown);
    const embeddingFloat32 = await embeddingService.generateEmbedding(plainText);
    const embedding = Array.from(embeddingFloat32);

    // Save embedding
    await noteRepository.updateEmbedding(noteId, embedding);

    // Find all matching topics above threshold
    const topics = await topicRepository.findAll();
    const matchedTopics: Array<{ topicId: string; topicName: string; confidence: number }> = [];

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
        if (similarity > 0.5) {
          matchedTopics.push({
            topicId: topic.id,
            topicName: topic.name,
            confidence: similarity,
          });
        }
      }
    }

    // Sort by confidence descending
    matchedTopics.sort((a, b) => b.confidence - a.confidence);

    // Assign the best matching topic if any
    if (matchedTopics.length > 0) {
      const bestTopic = matchedTopics[0];
      await topicRepository.assignToNote(noteId, bestTopic.topicId, {
        confidence: bestTopic.confidence,
      });

      this.deps.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
        noteId,
        topicId: bestTopic.topicId,
        confidence: bestTopic.confidence,
      });
    }

    return { noteId, topics: matchedTopics };
  }

  async classifyAllNotes(options?: {
    force?: boolean;
  }): Promise<{ processed: number; total: number; failed: number }> {
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) return { processed: 0, total: 0, failed: 0 };

    const notes = await this.deps.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    const total = notes.length;
    let processed = 0;
    let failed = 0;

    for (const note of notes) {
      try {
        await this.classifyNote(note.id, options?.force || false);
        processed++;

        // Emit progress event
        this.deps.eventPublisher?.emit(EVENTS.EMBEDDING_PROGRESS, {
          current: processed,
          total,
          failed,
        });
      } catch (error) {
        failed++;
        logger.error(`[TopicUseCases] Failed to classify note ${note.id}:`, error);
      }
    }

    logger.info(`[TopicUseCases] Classified ${processed}/${total} notes (${failed} failed)`);
    return { processed, total, failed };
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
    const results: SimilarNote[] = [];
    for (const result of similarNotes) {
      if (result.noteId !== noteId) {
        const note = await this.deps.noteRepository.findById(result.noteId);
        if (note) {
          results.push({
            noteId: result.noteId,
            title: note.title || 'Untitled',
            distance: result.distance,
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
          title: note.title || 'Untitled',
          distance: result.distance,
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
    ready: boolean;
    totalNotes: number;
    embeddedNotes: number;
    pendingNotes: number;
  }> {
    const activeWorkspace = await this.deps.workspaceRepository.findActive();
    if (!activeWorkspace) {
      return {
        ready: await this.deps.embeddingService.isReady(),
        totalNotes: 0,
        embeddedNotes: 0,
        pendingNotes: 0,
      };
    }

    const notes = await this.deps.noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });
    let embeddedNotes = 0;

    for (const note of notes) {
      const embedding = await this.deps.noteRepository.getEmbedding(note.id);
      if (embedding) embeddedNotes++;
    }

    return {
      ready: await this.deps.embeddingService.isReady(),
      totalNotes: notes.length,
      embeddedNotes,
      pendingNotes: notes.length - embeddedNotes,
    };
  }

  async getNotesForTopic(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<
    Array<{
      id: string;
      title: string;
      confidence: number;
      isManual: boolean;
    }>
  > {
    const notesForTopic = await this.deps.topicRepository.getNotesForTopic(topicId, options);

    // Fetch note titles
    const results: Array<{ id: string; title: string; confidence: number; isManual: boolean }> = [];
    for (const item of notesForTopic) {
      const note = await this.deps.noteRepository.findById(item.noteId);
      if (note) {
        results.push({
          id: item.noteId,
          title: note.title || 'Untitled',
          confidence: item.confidence,
          isManual: item.isManual,
        });
      }
    }

    return results;
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
