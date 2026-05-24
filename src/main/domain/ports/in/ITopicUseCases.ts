/**
 * Topic Use Cases Port
 *
 * Defines the contract for ML topic operations.
 */

// DTOs
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

export interface ClassifyAllResult {
  processed: number;
  total: number;
  failed: number;
}

export interface TopicSimilarNote {
  noteId: string;
  title: string;
  distance: number;
}

export interface EmbeddingStatus {
  ready: boolean;
  totalNotes: number;
  embeddedNotes: number;
  pendingNotes: number;
}

export interface NoteForTopic {
  id: string;
  title: string;
  confidence: number;
  isManual: boolean;
}

export interface TopicForNote {
  noteId: string;
  topicId: string;
  confidence: number;
  isManual: boolean;
  createdAt: Date;
  topicName: string;
  topicColor: string;
}

// Per-action ports
export interface IInitializeTopicsUseCase {
  execute(): Promise<{ success: boolean; ready: boolean }>;
}

export interface IGetAllTopicsUseCase {
  execute(): Promise<TopicDTO[]>;
}

export interface IGetTopicByIdUseCase {
  execute(id: string): Promise<TopicDTO | null>;
}

export interface ICreateTopicUseCase {
  execute(data: { name: string; description?: string; color?: string }): Promise<TopicDTO>;
}

export interface IUpdateTopicUseCase {
  execute(
    id: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<TopicDTO>;
}

export interface IDeleteTopicUseCase {
  execute(id: string): Promise<void>;
}

export interface IClassifyNoteUseCase {
  execute(noteId: string, force?: boolean): Promise<ClassifyResult>;
}

export interface IClassifyAllNotesUseCase {
  execute(options?: { force?: boolean; excludeJournal?: boolean }): Promise<ClassifyAllResult>;
}

export interface IAssignTopicToNoteUseCase {
  execute(noteId: string, topicId: string): Promise<void>;
}

export interface IRemoveTopicFromNoteUseCase {
  execute(noteId: string, topicId: string): Promise<void>;
}

export interface IGetTopicSimilarNotesUseCase {
  execute(noteId: string, limit?: number): Promise<TopicSimilarNote[]>;
}

export interface ITopicSemanticSearchUseCase {
  execute(query: string, limit?: number): Promise<TopicSimilarNote[]>;
}

export interface IRecomputeCentroidsUseCase {
  execute(): Promise<void>;
}

export interface IGetEmbeddingStatusUseCase {
  execute(): Promise<EmbeddingStatus>;
}

export interface IGetNotesForTopicUseCase {
  execute(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<NoteForTopic[]>;
}

export interface IGetTopicsForNoteUseCase {
  execute(noteId: string): Promise<TopicForNote[]>;
}

// --- Suggestion use cases ---

export interface SuggestedTopicRepresentative {
  chunkId: string;
  noteId: string;
  noteTitle: string;
  headingPath: string[];
  excerpt: string;
}

export interface SuggestedTopic {
  id: string;
  label: string;
  altLabels: string[];
  noteIds: string[];
  chunkIds: string[];
  noteCount: number;
  chunkCount: number;
  cohesion: number;
  representatives: SuggestedTopicRepresentative[];
}

export interface SuggestTopicsRequest {
  workspaceId?: string;
}

export interface ISuggestTopicsUseCase {
  execute(request?: SuggestTopicsRequest): Promise<SuggestedTopic[]>;
}

export interface AdoptSuggestedTopicRequest {
  name: string;
  color?: string;
  noteIds: string[];
}

export interface AdoptSuggestedTopicResponse {
  topicId: string;
  assignedNoteCount: number;
}

export interface IAdoptSuggestedTopicUseCase {
  execute(request: AdoptSuggestedTopicRequest): Promise<AdoptSuggestedTopicResponse>;
}

/**
 * Aggregated topic use cases interface for DI container.
 */
export interface ITopicUseCases {
  initialize: IInitializeTopicsUseCase;
  getAllTopics: IGetAllTopicsUseCase;
  getTopicById: IGetTopicByIdUseCase;
  createTopic: ICreateTopicUseCase;
  updateTopic: IUpdateTopicUseCase;
  deleteTopic: IDeleteTopicUseCase;
  classifyNote: IClassifyNoteUseCase;
  classifyAllNotes: IClassifyAllNotesUseCase;
  assignTopicToNote: IAssignTopicToNoteUseCase;
  removeTopicFromNote: IRemoveTopicFromNoteUseCase;
  getSimilarNotes: IGetTopicSimilarNotesUseCase;
  semanticSearch: ITopicSemanticSearchUseCase;
  recomputeCentroids: IRecomputeCentroidsUseCase;
  getEmbeddingStatus: IGetEmbeddingStatusUseCase;
  getNotesForTopic: IGetNotesForTopicUseCase;
  getTopicsForNote: IGetTopicsForNoteUseCase;
  suggestTopics: ISuggestTopicsUseCase;
  adoptSuggestedTopic: IAdoptSuggestedTopicUseCase;
}
