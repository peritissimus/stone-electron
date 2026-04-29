/**
 * Topic Repository Port
 *
 * Defines the contract for topic persistence operations.
 */

import type { TopicProps, TopicEntity, TopicWithCount } from '../../entities';

export interface NoteTopicAssignment {
  noteId: string;
  topicId: string;
  confidence: number;
  isManual: boolean;
  createdAt: Date;
}

export interface NoteTopicWithDetails extends NoteTopicAssignment {
  topicName: string;
  topicColor: string;
}

export interface ITopicRepository {
  /**
   * Find topic by ID
   */
  findById(id: string): Promise<TopicProps | null>;

  /**
   * Find topic by name
   */
  findByName(name: string): Promise<TopicProps | null>;

  /**
   * Get all topics
   */
  findAll(): Promise<TopicProps[]>;

  /**
   * Get all topics with note counts
   */
  findAllWithCounts(options?: { excludeJournal?: boolean }): Promise<TopicWithCount[]>;

  /**
   * Get predefined topics
   */
  findPredefined(): Promise<TopicProps[]>;

  /**
   * Save a topic
   */
  save(topic: TopicEntity): Promise<void>;

  /**
   * Delete a topic
   */
  delete(id: string): Promise<void>;

  /**
   * Check if topic exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get topics for a note
   */
  getTopicsForNote(noteId: string): Promise<NoteTopicWithDetails[]>;

  /**
   * Get topics for multiple notes (bulk)
   */
  getTopicsForNotes(noteIds: string[]): Promise<Map<string, NoteTopicWithDetails[]>>;

  /**
   * Get notes for a topic
   */
  getNotesForTopic(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<{ noteId: string; confidence: number; isManual: boolean }[]>;

  /**
   * Assign topic to note
   */
  assignToNote(
    noteId: string,
    topicId: string,
    options?: { confidence?: number; isManual?: boolean },
  ): Promise<void>;

  /**
   * Remove topic from note
   */
  removeFromNote(noteId: string, topicId: string): Promise<void>;

  /**
   * Set all topics for a note (replaces existing)
   */
  setTopicsForNote(
    noteId: string,
    assignments: { topicId: string; confidence?: number; isManual?: boolean }[],
  ): Promise<void>;

  /**
   * Clear all topics for a note
   */
  clearTopicsForNote(noteId: string): Promise<void>;

  /**
   * Clear only auto-assigned topics for a note (preserves manual assignments)
   */
  clearAutoTopicsForNote(noteId: string): Promise<void>;

  /**
   * Update topic centroid (ML)
   */
  updateCentroid(topicId: string, centroid: Uint8Array): Promise<void>;

  /**
   * Update note count for a topic
   */
  updateNoteCount(topicId: string): Promise<void>;
}
