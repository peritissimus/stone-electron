/**
 * Topic Use Cases Port
 *
 * Defines the contract for ML topic operations.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';

// DTOs
export interface TopicDTO {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPredefined: boolean;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
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
  /** Cosine similarity in [-1, 1]; higher is a closer match. */
  similarity: number;
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
  execute(): Effect.Effect<{ success: boolean; ready: boolean }, Error>;
}

export interface IGetAllTopicsUseCase {
  execute(): Effect.Effect<TopicDTO[], Error>;
}

export interface IGetTopicByIdUseCase {
  execute(id: string): Effect.Effect<TopicDTO | null, Error>;
}

export interface ICreateTopicUseCase {
  execute(data: { name: string; description?: string; color?: string }): Effect.Effect<TopicDTO, Error>;
}

export interface IUpdateTopicUseCase {
  execute(
    id: string,
    data: { name?: string; description?: string; color?: string },
  ): Effect.Effect<TopicDTO, Error>;
}

export interface IDeleteTopicUseCase {
  execute(id: string): Effect.Effect<void, Error>;
}

export interface IClassifyNoteUseCase {
  execute(noteId: string, force?: boolean): Effect.Effect<ClassifyResult, Error>;
}

export interface IClassifyAllNotesUseCase {
  execute(options?: { force?: boolean; excludeJournal?: boolean }): Effect.Effect<ClassifyAllResult, Error>;
}

export interface IAssignTopicToNoteUseCase {
  execute(noteId: string, topicId: string): Effect.Effect<void, Error>;
}

export interface IRemoveTopicFromNoteUseCase {
  execute(noteId: string, topicId: string): Effect.Effect<void, Error>;
}

export interface IGetTopicSimilarNotesUseCase {
  execute(noteId: string, limit?: number): Effect.Effect<TopicSimilarNote[], Error>;
}

export interface ITopicSemanticSearchUseCase {
  execute(query: string, limit?: number): Effect.Effect<TopicSimilarNote[], Error>;
}

export interface IRecomputeCentroidsUseCase {
  execute(): Effect.Effect<void, Error>;
}

export interface IGetEmbeddingStatusUseCase {
  execute(): Effect.Effect<EmbeddingStatus, Error>;
}

export interface IGetNotesForTopicUseCase {
  execute(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Effect.Effect<NoteForTopic[], Error>;
}

export interface IGetTopicsForNoteUseCase {
  execute(noteId: string): Effect.Effect<TopicForNote[], Error>;
}

// --- Automatic organization ---

export interface OrganizeTopicsRequest {
  workspaceId?: string;
}

export interface OrganizeTopicsResult {
  /** False when there is no workspace to organize — the pass did nothing. */
  ran: boolean;
  topicsCreated: number;
  /** Notes attached to the topics created by this pass. */
  notesAssigned: number;
  /** Previously untopiced notes matched against existing topics. */
  notesClassified: number;
}

/**
 * Clusters the workspace, promotes the clusters worth keeping to topics, and
 * files unassigned notes under the topics that already exist. Runs on a timer
 * in the background; topics are not user-managed.
 */
export interface IOrganizeTopicsUseCase {
  execute(request?: OrganizeTopicsRequest): Effect.Effect<OrganizeTopicsResult, Error>;
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
  organizeTopics: IOrganizeTopicsUseCase;
}

export const TopicUseCasesPort =
  Context.GenericTag<ITopicUseCases>('stone/ITopicUseCases');
