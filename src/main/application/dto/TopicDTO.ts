/**
 * Topic DTOs - Data transfer objects for ML topic classification
 */

/**
 * Topic response
 */
export interface TopicDTO {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPredefined: boolean;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create topic request
 */
export interface CreateTopicRequestDTO {
  name: string;
  description?: string;
  color?: string;
}

/**
 * Update topic request
 */
export interface UpdateTopicRequestDTO {
  id: string;
  name?: string;
  description?: string;
  color?: string;
}

/**
 * Classify note request
 */
export interface ClassifyNoteRequestDTO {
  noteId: string;
  force?: boolean;
}

/**
 * Classify note response
 */
export interface ClassifyNoteResponseDTO {
  noteId: string;
  topicId: string | null;
  topicName: string | null;
  confidence: number;
}

/**
 * Classify all notes request
 */
export interface ClassifyAllRequestDTO {
  force?: boolean;
  onlyUnclassified?: boolean;
}

/**
 * Classify all response
 */
export interface ClassifyAllResponseDTO {
  processed: number;
  classified: number;
  failed: number;
}

/**
 * Similar notes request
 */
export interface SimilarNotesRequestDTO {
  noteId: string;
  limit?: number;
  minScore?: number;
}

/**
 * Similar note result
 */
export interface SimilarNoteDTO {
  noteId: string;
  noteTitle: string;
  similarity: number;
}

/**
 * Semantic search request
 */
export interface SemanticSearchRequestDTO {
  query: string;
  limit?: number;
  minScore?: number;
}

/**
 * Assign topic request
 */
export interface AssignTopicRequestDTO {
  noteId: string;
  topicId: string;
}

/**
 * Embedding status response
 */
export interface EmbeddingStatusDTO {
  totalNotes: number;
  notesWithEmbeddings: number;
  notesWithoutEmbeddings: number;
  modelName: string;
  dimensions: number;
  isReady: boolean;
}
