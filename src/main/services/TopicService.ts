/**
 * TopicService - Handles note classification and topic management
 *
 * Provides:
 * - Note classification using embeddings
 * - Semantic search across notes
 * - Topic centroid computation
 */

import { logger } from '../utils/logger';
import type { Topic, TopicWithCount, NoteTopicWithDetails } from '../repositories/TopicRepository';
import type { TopicRepository } from '../repositories/TopicRepository';
import type { NoteRepository } from '../repositories/NoteRepository';
import type { EmbeddingService } from './EmbeddingService';
import type { MarkdownService } from './MarkdownService';

// Cosine similarity threshold for auto-classification
const CLASSIFICATION_THRESHOLD = 0.5;

// Maximum topics to assign per note
const MAX_TOPICS_PER_NOTE = 3;

// Predefined topics with their metadata
const PREDEFINED_TOPICS = [
  { id: 'topic_work', name: 'Work', description: 'Work-related notes, meetings, and tasks', color: '#3b82f6' },
  { id: 'topic_personal', name: 'Personal', description: 'Personal thoughts, journal entries, and reflections', color: '#10b981' },
  { id: 'topic_learning', name: 'Learning', description: 'Study notes, tutorials, and educational content', color: '#8b5cf6' },
  { id: 'topic_projects', name: 'Projects', description: 'Project documentation, technical specs, and development', color: '#f59e0b' },
  { id: 'topic_ideas', name: 'Ideas', description: 'Brainstorming, concepts, and creative thoughts', color: '#ec4899' },
];

// Keyword-based classification for bootstrapping (when no centroids exist)
const TOPIC_KEYWORDS: Record<string, string[]> = {
  topic_work: ['meeting', 'project', 'deadline', 'client', 'work', 'office', 'team', 'sprint', 'standup', 'review', 'report', 'email', 'colleague', 'manager', 'task', 'milestone', 'stakeholder', 'presentation', 'agenda'],
  topic_personal: ['personal', 'journal', 'diary', 'reflection', 'life', 'family', 'friend', 'hobby', 'health', 'goal', 'dream', 'gratitude', 'feeling', 'emotion', 'self', 'home', 'weekend', 'vacation'],
  topic_learning: ['learn', 'study', 'course', 'tutorial', 'book', 'reading', 'education', 'skill', 'practice', 'lesson', 'concept', 'understand', 'knowledge', 'research', 'notes', 'class', 'lecture', 'training'],
  topic_projects: ['project', 'build', 'develop', 'implement', 'design', 'feature', 'architecture', 'code', 'api', 'database', 'deploy', 'release', 'version', 'roadmap', 'requirements', 'spec', 'technical'],
  topic_ideas: ['idea', 'brainstorm', 'concept', 'thought', 'maybe', 'could', 'might', 'explore', 'experiment', 'innovation', 'creative', 'possibility', 'potential', 'consider', 'imagine', 'what if', 'future'],
};

export interface ClassificationResult {
  topicId: string;
  topicName: string;
  confidence: number;
}

export interface SimilarNote {
  noteId: string;
  title: string;
  distance: number;
}

/**
 * Dependencies for TopicService
 */
export interface TopicServiceDeps {
  topicRepository: TopicRepository;
  noteRepository: NoteRepository;
  embeddingService: EmbeddingService;
  markdownService: MarkdownService;
}

export class TopicService {
  constructor(private readonly deps: TopicServiceDeps) {}

  /**
   * Initialize the topic service (ensures embedding service is ready and seeds topics)
   */
  async initialize(): Promise<void> {
    logger.info('[TopicService] Initializing...');

    // Seed predefined topics if they don't exist
    await this.seedPredefinedTopics();

    await this.deps.embeddingService.initialize();
    logger.info('[TopicService] Ready');
  }

  /**
   * Seed predefined topics if they don't exist
   */
  private async seedPredefinedTopics(): Promise<void> {
    const existingTopics = await this.deps.topicRepository.getAll();

    if (existingTopics.length === 0) {
      logger.info('[TopicService] Seeding predefined topics...');

      for (const topicData of PREDEFINED_TOPICS) {
        await this.deps.topicRepository.create({
          id: topicData.id,
          name: topicData.name,
          description: topicData.description,
          color: topicData.color,
          isPredefined: true,
        });
        logger.info(`[TopicService] Created topic: ${topicData.name}`);
      }

      logger.info('[TopicService] Predefined topics seeded');
    } else {
      // Ensure all predefined topics exist (in case new ones were added)
      for (const topicData of PREDEFINED_TOPICS) {
        const existing = await this.deps.topicRepository.findById(topicData.id);
        if (!existing) {
          await this.deps.topicRepository.create({
            id: topicData.id,
            name: topicData.name,
            description: topicData.description,
            color: topicData.color,
            isPredefined: true,
          });
          logger.info(`[TopicService] Created missing predefined topic: ${topicData.name}`);
        }
      }
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.deps.embeddingService.isReady();
  }

  /**
   * Get all topics with note counts
   */
  async getAllTopics(): Promise<TopicWithCount[]> {
    return this.deps.topicRepository.getAllWithCounts();
  }

  /**
   * Get a topic by ID
   */
  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.deps.topicRepository.findById(id);
  }

  /**
   * Create a new topic
   */
  async createTopic(data: { name: string; description?: string; color?: string }): Promise<Topic> {
    return this.deps.topicRepository.create(data);
  }

  /**
   * Update a topic
   */
  async updateTopic(id: string, data: Partial<Topic>): Promise<Topic> {
    return this.deps.topicRepository.update(id, data);
  }

  /**
   * Delete a topic
   */
  async deleteTopic(id: string): Promise<boolean> {
    return this.deps.topicRepository.deleteWithAssociations(id);
  }

  /**
   * Get topics for a note
   */
  async getTopicsForNote(noteId: string): Promise<NoteTopicWithDetails[]> {
    return this.deps.topicRepository.getTopicsForNote(noteId);
  }

  /**
   * Classify a note into topics based on embedding similarity
   */
  async classifyNote(noteId: string): Promise<ClassificationResult[]> {
    logger.info(`[TopicService] Classifying note: ${noteId}`);

    // Get note content
    const note = await this.deps.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const content = await this.deps.noteRepository.getContentById(noteId);
    if (!content || content.trim().length === 0) {
      logger.warn(`[TopicService] Note ${noteId} has no content to classify`);
      return [];
    }

    // Convert HTML to plain text for embedding
    const plainText = this.deps.markdownService.htmlToPlainText(content);

    // Get all topics
    const allTopics = await this.deps.topicRepository.getAll();

    // Try to get embedding for the note content
    let embedding: number[] | null = null;
    try {
      embedding = await this.deps.embeddingService.getEmbedding(plainText);

      // Try to store embedding in the database (non-fatal if fails)
      try {
        await this.deps.noteRepository.updateEmbedding(noteId, embedding);
      } catch (embedError) {
        logger.warn(`[TopicService] Failed to store embedding for note ${noteId} (non-fatal):`, embedError);
        // Continue with classification using the embedding in memory
      }
    } catch (embeddingError) {
      logger.warn(`[TopicService] Failed to generate embedding for note ${noteId}, falling back to keywords:`, embeddingError);
      // Fall back to keyword-based classification
      return this.classifyByKeywords(noteId, plainText, allTopics);
    }

    // Get topics with centroids for similarity comparison
    const topicsWithCentroids = allTopics.filter(t => t.centroid !== null);

    if (topicsWithCentroids.length === 0) {
      // Fallback to keyword-based classification for bootstrapping
      logger.info('[TopicService] No centroids available, using keyword-based classification');
      return this.classifyByKeywords(noteId, plainText, allTopics);
    }

    // Compute similarity with each topic centroid
    const similarities: ClassificationResult[] = [];

    for (const topic of topicsWithCentroids) {
      const centroid = this.bufferToFloatArray(topic.centroid!);
      const similarity = this.cosineSimilarity(embedding, centroid);

      if (similarity >= CLASSIFICATION_THRESHOLD) {
        similarities.push({
          topicId: topic.id,
          topicName: topic.name,
          confidence: similarity,
        });
      }
    }

    // Sort by confidence and take top N
    similarities.sort((a, b) => b.confidence - a.confidence);
    const topMatches = similarities.slice(0, MAX_TOPICS_PER_NOTE);

    // Assign topics to note
    if (topMatches.length > 0) {
      await this.deps.topicRepository.setTopicsForNote(
        noteId,
        topMatches.map(m => ({
          topicId: m.topicId,
          confidence: m.confidence,
          isManual: false,
        }))
      );
    }

    logger.info(`[TopicService] Classified note ${noteId} into ${topMatches.length} topics`);
    return topMatches;
  }

  /**
   * Manually assign a topic to a note
   */
  async assignTopicToNote(noteId: string, topicId: string): Promise<void> {
    await this.deps.topicRepository.assignToNote(noteId, topicId, {
      confidence: 1,
      isManual: true,
    });
    logger.info(`[TopicService] Manually assigned topic ${topicId} to note ${noteId}`);
  }

  /**
   * Remove a topic from a note
   */
  async removeTopicFromNote(noteId: string, topicId: string): Promise<void> {
    await this.deps.topicRepository.removeFromNote(noteId, topicId);
    logger.info(`[TopicService] Removed topic ${topicId} from note ${noteId}`);
  }

  /**
   * Semantic search - find notes similar to a query
   */
  async semanticSearch(query: string, limit = 10): Promise<SimilarNote[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    logger.info(`[TopicService] Semantic search: "${query.substring(0, 50)}..."`);

    // Get embedding for the query
    const queryEmbedding = await this.deps.embeddingService.getEmbedding(query);

    // Find similar notes
    const results = await this.deps.noteRepository.findBySimilarity(queryEmbedding, limit);

    return results;
  }

  /**
   * Find notes similar to a given note
   */
  async findSimilarNotes(noteId: string, limit = 5): Promise<SimilarNote[]> {
    const note = await this.deps.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get note's embedding
    const embedding = await this.deps.noteRepository.getEmbedding(noteId);
    if (!embedding) {
      logger.warn(`[TopicService] Note ${noteId} has no embedding`);
      return [];
    }

    // Find similar notes (excluding self)
    const results = await this.deps.noteRepository.findBySimilarity(embedding, limit + 1);
    return results.filter(r => r.noteId !== noteId).slice(0, limit);
  }

  /**
   * Recompute centroid for a topic based on assigned notes
   */
  async recomputeTopicCentroid(topicId: string): Promise<void> {
    logger.info(`[TopicService] Recomputing centroid for topic: ${topicId}`);

    // Get all notes assigned to this topic
    const noteAssignments = await this.deps.topicRepository.getNotesForTopic(topicId, { limit: 1000 });

    if (noteAssignments.length === 0) {
      logger.warn(`[TopicService] Topic ${topicId} has no notes, skipping centroid computation`);
      return;
    }

    // Get embeddings for all notes
    const embeddings: number[][] = [];
    for (const { noteId } of noteAssignments) {
      const embedding = await this.deps.noteRepository.getEmbedding(noteId);
      if (embedding) {
        embeddings.push(embedding);
      }
    }

    if (embeddings.length === 0) {
      logger.warn(`[TopicService] No embeddings found for topic ${topicId}`);
      return;
    }

    // Compute centroid (average of all embeddings)
    const dims = embeddings[0].length;
    const centroid = new Array(dims).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dims; i++) {
        centroid[i] += emb[i];
      }
    }

    for (let i = 0; i < dims; i++) {
      centroid[i] /= embeddings.length;
    }

    // Normalize the centroid
    const norm = Math.sqrt(centroid.reduce((sum, x) => sum + x * x, 0));
    if (norm > 0) {
      for (let i = 0; i < dims; i++) {
        centroid[i] /= norm;
      }
    }

    // Store centroid (non-fatal if fails - blob storage issues with libsql)
    try {
      const centroidBuffer = this.floatArrayToBuffer(centroid);
      await this.deps.topicRepository.updateCentroid(topicId, centroidBuffer);
      logger.info(`[TopicService] Updated centroid for topic ${topicId} (${embeddings.length} notes)`);
    } catch (error) {
      logger.warn(`[TopicService] Failed to store centroid for topic ${topicId} (non-fatal). Keyword classification will be used.`, error);
      // Classification will fall back to keyword-based when centroids are missing
    }
  }

  /**
   * Recompute centroids for all topics
   */
  async recomputeAllCentroids(): Promise<void> {
    logger.info('[TopicService] Recomputing all topic centroids...');

    const allTopics = await this.deps.topicRepository.getAll();

    for (const topic of allTopics) {
      try {
        await this.recomputeTopicCentroid(topic.id);
      } catch (error) {
        logger.error(`[TopicService] Failed to recompute centroid for topic ${topic.id}:`, error);
      }
    }

    logger.info('[TopicService] Finished recomputing all centroids');
  }

  /**
   * Get notes for a topic
   */
  async getNotesForTopic(topicId: string, options: { limit?: number; offset?: number } = {}) {
    const noteAssignments = await this.deps.topicRepository.getNotesForTopic(topicId, options);

    // Get full note details
    const noteIds = noteAssignments.map(a => a.noteId);
    const notes = await Promise.all(
      noteIds.map(async (id) => {
        const note = await this.deps.noteRepository.findById(id);
        const assignment = noteAssignments.find(a => a.noteId === id);
        return note ? {
          ...note,
          confidence: assignment?.confidence ?? 1,
          isManual: assignment?.isManual ?? false,
        } : null;
      })
    );

    return notes.filter(n => n !== null);
  }

  /**
   * Keyword-based classification for bootstrapping (when no centroids exist)
   */
  private async classifyByKeywords(
    noteId: string,
    text: string,
    allTopics: Topic[]
  ): Promise<ClassificationResult[]> {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    const wordSet = new Set(words);

    const scores: ClassificationResult[] = [];

    for (const topic of allTopics) {
      const keywords = TOPIC_KEYWORDS[topic.id];
      if (!keywords) continue;

      // Count keyword matches
      let matchCount = 0;
      for (const keyword of keywords) {
        // Check both exact word match and substring match
        if (wordSet.has(keyword) || lowerText.includes(keyword)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        // Normalize confidence: more matches = higher confidence (max 0.9)
        const confidence = Math.min(0.9, matchCount / keywords.length * 2);
        scores.push({
          topicId: topic.id,
          topicName: topic.name,
          confidence,
        });
      }
    }

    // Sort by confidence and take top N
    scores.sort((a, b) => b.confidence - a.confidence);
    const topMatches = scores.slice(0, MAX_TOPICS_PER_NOTE);

    // Assign topics to note
    if (topMatches.length > 0) {
      await this.deps.topicRepository.setTopicsForNote(
        noteId,
        topMatches.map(m => ({
          topicId: m.topicId,
          confidence: m.confidence,
          isManual: false,
        }))
      );

      logger.info(`[TopicService] Keyword-classified note ${noteId} into ${topMatches.length} topics: ${topMatches.map(t => t.topicName).join(', ')}`);
    }

    return topMatches;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Convert Uint8Array/Buffer to Float32Array
   */
  private bufferToFloatArray(data: Uint8Array | Buffer): number[] {
    let uint8: Uint8Array;
    // Check Buffer first since Buffer extends Uint8Array
    if (Buffer.isBuffer(data)) {
      uint8 = new Uint8Array(data.buffer, data.byteOffset, data.length);
    } else if (data instanceof Uint8Array) {
      uint8 = data;
    } else {
      throw new TypeError('Invalid data type for embedding');
    }
    const floats = new Float32Array(uint8.buffer, uint8.byteOffset, uint8.length / 4);
    return Array.from(floats);
  }

  /**
   * Convert Float32Array to Uint8Array (for libsql compatibility)
   */
  private floatArrayToBuffer(array: number[]): Uint8Array {
    const floats = new Float32Array(array);
    return new Uint8Array(floats.buffer);
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getEmbeddingService } from './EmbeddingService';
import { getMarkdownService } from './MarkdownService';

let instance: TopicService | null = null;

/**
 * Get or create topic service instance
 */
export function getTopicService(): TopicService {
  if (!instance) {
    const repos = getRepositories();
    instance = new TopicService({
      topicRepository: repos.topic,
      noteRepository: repos.note,
      embeddingService: getEmbeddingService(),
      markdownService: getMarkdownService(),
    });
  }
  return instance;
}

/**
 * Create TopicService with custom dependencies (for DI container)
 */
export function createTopicService(deps: TopicServiceDeps): TopicService {
  return new TopicService(deps);
}
