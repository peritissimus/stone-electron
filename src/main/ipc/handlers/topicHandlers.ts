/**
 * Topic IPC Handlers
 *
 * Handles all topic-related IPC channels including:
 * - Topic CRUD operations
 * - Note classification
 * - Semantic search
 * - Embedding management
 */

import { TOPIC_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { registerHandler, IpcError } from '../utils';
import { logger } from '../../utils/logger';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

/**
 * Register all topic handlers
 */
export function registerTopicHandlers(container: AwilixContainer<Container>) {
  const repos = {
    topic: container.cradle.topicRepository,
    note: container.cradle.noteRepository,
  };
  const topicService = container.cradle.topicService;
  const eventBus = container.cradle.eventBus;

  // topics:initialize - Initialize the embedding service
  registerHandler(
    TOPIC_CHANNELS.INITIALIZE,
    async () => {
      try {
        await topicService.initialize();
        return { success: true, ready: topicService.isReady() };
      } catch (error) {
        logger.error('[TopicHandlers] Failed to initialize:', error);
        return { success: false, ready: false, error: String(error) };
      }
    }
  );

  // topics:getAll - Get all topics with note counts
  registerHandler(
    TOPIC_CHANNELS.GET_ALL,
    async () => {
      const topics = await topicService.getAllTopics();
      return { topics };
    }
  );

  // topics:getById - Get a specific topic
  registerHandler(
    TOPIC_CHANNELS.GET_BY_ID,
    async (event, request: { id: string }) => {
      const topic = await topicService.getTopicById(request.id);
      if (!topic) {
        throw new IpcError('NOT_FOUND', 'Topic not found');
      }
      return { topic };
    }
  );

  // topics:create - Create a new topic
  registerHandler(
    TOPIC_CHANNELS.CREATE,
    async (event, request: { name: string; description?: string; color?: string }) => {
      // Check if topic already exists
      const existing = await repos.topic.findByName(request.name);
      if (existing) {
        throw new IpcError('DUPLICATE', 'Topic with this name already exists');
      }

      const topic = await topicService.createTopic({
        name: request.name,
        description: request.description,
        color: request.color,
      });

      // Broadcast event
      eventBus.emit(EVENTS.TOPIC_CREATED, { topic });

      return { topic };
    }
  );

  // topics:update - Update a topic
  registerHandler(
    TOPIC_CHANNELS.UPDATE,
    async (event, request: { id: string; name?: string; description?: string; color?: string }) => {
      const existing = await repos.topic.findById(request.id);
      if (!existing) {
        throw new IpcError('NOT_FOUND', 'Topic not found');
      }

      // Check for name conflict if name is being changed
      if (request.name && request.name !== existing.name) {
        const nameConflict = await repos.topic.findByName(request.name);
        if (nameConflict) {
          throw new IpcError('DUPLICATE', 'Topic with this name already exists');
        }
      }

      const topic = await topicService.updateTopic(request.id, {
        name: request.name,
        description: request.description,
        color: request.color,
      });

      // Broadcast event
      eventBus.emit(EVENTS.TOPIC_UPDATED, { topic });

      return { topic };
    }
  );

  // topics:delete - Delete a topic
  registerHandler(
    TOPIC_CHANNELS.DELETE,
    async (event, request: { id: string }) => {
      const topic = await repos.topic.findById(request.id);
      if (!topic) {
        throw new IpcError('NOT_FOUND', 'Topic not found');
      }

      // Don't allow deleting predefined topics
      if (topic.isPredefined) {
        throw new IpcError('FORBIDDEN', 'Cannot delete predefined topics');
      }

      await topicService.deleteTopic(request.id);

      // Broadcast event
      eventBus.emit(EVENTS.TOPIC_DELETED, { id: request.id });

      return { success: true };
    }
  );

  // topics:getNotesByTopic - Get notes assigned to a topic
  registerHandler(
    TOPIC_CHANNELS.GET_NOTES_BY_TOPIC,
    async (event, request: { topicId: string; limit?: number; offset?: number; excludeJournal?: boolean }) => {
      const notes = await topicService.getNotesForTopic(request.topicId, {
        limit: request.limit,
        offset: request.offset,
        excludeJournal: request.excludeJournal,
      });
      return { notes };
    }
  );

  // topics:getTopicsForNote - Get topics assigned to a note
  registerHandler(
    TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE,
    async (event, request: { noteId: string }) => {
      const topics = await topicService.getTopicsForNote(request.noteId);
      return { topics };
    }
  );

  // topics:assignToNote - Manually assign a topic to a note
  registerHandler(
    TOPIC_CHANNELS.ASSIGN_TO_NOTE,
    async (event, request: { noteId: string; topicId: string }) => {
      const note = await repos.note.findById(request.noteId);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      const topic = await repos.topic.findById(request.topicId);
      if (!topic) {
        throw new IpcError('NOT_FOUND', 'Topic not found');
      }

      await topicService.assignTopicToNote(request.noteId, request.topicId);

      return { success: true };
    }
  );

  // topics:removeFromNote - Remove a topic from a note
  registerHandler(
    TOPIC_CHANNELS.REMOVE_FROM_NOTE,
    async (event, request: { noteId: string; topicId: string }) => {
      await topicService.removeTopicFromNote(request.noteId, request.topicId);
      return { success: true };
    }
  );

  // topics:classifyNote - Classify a single note into topics
  registerHandler(
    TOPIC_CHANNELS.CLASSIFY_NOTE,
    async (event, request: { noteId: string }) => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      const note = await repos.note.findById(request.noteId);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      const results = await topicService.classifyNote(request.noteId);

      // Broadcast event
      eventBus.emit(EVENTS.NOTE_CLASSIFIED, {
        noteId: request.noteId,
        topics: results,
      });

      return { noteId: request.noteId, topics: results };
    }
  );

  // topics:classifyAll - Classify all notes (background task)
  registerHandler(
    TOPIC_CHANNELS.CLASSIFY_ALL,
    async (event, request?: { excludeJournal?: boolean }) => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      // Get notes without embeddings
      let notesToProcess = await repos.note.getNotesWithoutEmbeddings(1000);

      // Filter out Journal notes if requested
      if (request?.excludeJournal) {
        notesToProcess = notesToProcess.filter(
          (note) => !note.filePath?.startsWith('Journal/')
        );
        logger.info(`[TopicHandlers] Excluding Journal notes from classification`);
      }

      const total = notesToProcess.length;
      let processed = 0;
      let failed = 0;

      logger.info(`[TopicHandlers] Starting bulk classification of ${total} notes`);

      for (const note of notesToProcess) {
        try {
          await topicService.classifyNote(note.id);
          processed++;

          // Send progress updates every 10 notes
          if (processed % 10 === 0) {
            eventBus.emit(EVENTS.EMBEDDING_PROGRESS, {
              processed,
              total,
              failed,
            });
          }
        } catch (error) {
          logger.error(`[TopicHandlers] Failed to classify note ${note.id}:`, error);
          failed++;
        }
      }

      // Recompute centroids after bulk classification
      await topicService.recomputeAllCentroids();

      logger.info(`[TopicHandlers] Bulk classification complete: ${processed}/${total} (${failed} failed)`);

      return { processed, total, failed };
    }
  );

  // topics:reclassifyAll - Force reclassification of ALL notes (ignores embedding status)
  registerHandler(
    TOPIC_CHANNELS.RECLASSIFY_ALL,
    async (event, request?: { excludeJournal?: boolean }) => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      // Get only active (non-deleted) notes
      let allNotes = await repos.note.findAll({
        where: { isDeleted: false },
        limit: 10000,
      });

      // Filter out Journal notes if requested
      if (request?.excludeJournal) {
        allNotes = allNotes.filter(
          (note) => !note.filePath?.startsWith('Journal/')
        );
        logger.info(`[TopicHandlers] Excluding Journal notes from reclassification`);
      }

      const total = allNotes.length;
      let processed = 0;
      let failed = 0;
      let skipped = 0;

      logger.info(`[TopicHandlers] Starting FULL reclassification of ${total} active notes`);

      for (const note of allNotes) {
        try {
          const result = await topicService.classifyNote(note.id);
          if (result.length === 0) {
            skipped++; // Empty notes are skipped
          }
          processed++;

          // Send progress updates every 10 notes
          if (processed % 10 === 0) {
            eventBus.emit(EVENTS.EMBEDDING_PROGRESS, {
              processed,
              total,
              failed,
              skipped,
            });
          }
        } catch (error) {
          logger.error(`[TopicHandlers] Failed to reclassify note ${note.id}:`, error);
          failed++;
        }
      }

      // Recompute centroids after reclassification
      await topicService.recomputeAllCentroids();

      logger.info(`[TopicHandlers] Full reclassification complete: ${processed}/${total} (${failed} failed, ${skipped} skipped empty)`);

      return { processed, total, failed, skipped };
    }
  );

  // topics:semanticSearch - Search notes by semantic similarity
  registerHandler(
    TOPIC_CHANNELS.SEMANTIC_SEARCH,
    async (event, request: { query: string; limit?: number }) => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      const results = await topicService.semanticSearch(request.query, request.limit || 10);
      return { results };
    }
  );

  // topics:getSimilarNotes - Find notes similar to a given note
  registerHandler(
    TOPIC_CHANNELS.GET_SIMILAR_NOTES,
    async (event, request: { noteId: string; limit?: number }) => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      const note = await repos.note.findById(request.noteId);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      const similar = await topicService.findSimilarNotes(request.noteId, request.limit || 5);
      return { similar };
    }
  );

  // topics:recomputeCentroids - Recompute all topic centroids
  registerHandler(
    TOPIC_CHANNELS.RECOMPUTE_CENTROIDS,
    async () => {
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      await topicService.recomputeAllCentroids();
      return { success: true };
    }
  );

  // topics:getEmbeddingStatus - Get embedding statistics
  registerHandler(
    TOPIC_CHANNELS.GET_EMBEDDING_STATUS,
    async () => {
      const counts = await repos.note.countWithEmbeddings();
      const isReady = topicService.isReady();

      return {
        ready: isReady,
        totalNotes: counts.total,
        embeddedNotes: counts.withEmbeddings,
        pendingNotes: counts.total - counts.withEmbeddings,
      };
    }
  );
}
