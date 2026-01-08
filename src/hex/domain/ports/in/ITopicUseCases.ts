/**
 * Topic Use Cases Port
 *
 * Defines the contract for ML topic operations.
 */

import type { TopicProps, TopicWithCount, NoteProps } from '../../entities';

// Request/Response types
export interface CreateTopicRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateTopicResponse {
  topic: TopicProps;
}

export interface UpdateTopicRequest {
  id: string;
  name?: string;
  description?: string;
  color?: string;
}

export interface UpdateTopicResponse {
  topic: TopicProps;
}

export interface DeleteTopicRequest {
  id: string;
}

export interface ListTopicsRequest {
  excludeJournal?: boolean;
}

export interface ListTopicsResponse {
  topics: TopicWithCount[];
}

export interface GetTopicRequest {
  id: string;
}

export interface GetTopicResponse {
  topic: TopicProps;
}

export interface GetNotesForTopicRequest {
  topicId: string;
  limit?: number;
  offset?: number;
  excludeJournal?: boolean;
}

export interface GetNotesForTopicResponse {
  notes: NoteProps[];
}

export interface GetTopicsForNoteRequest {
  noteId: string;
}

export interface GetTopicsForNoteResponse {
  topics: Array<{
    topicId: string;
    topicName: string;
    topicColor: string;
    confidence: number;
    isManual: boolean;
  }>;
}

export interface AssignTopicRequest {
  noteId: string;
  topicId: string;
}

export interface RemoveTopicRequest {
  noteId: string;
  topicId: string;
}

export interface ClassifyNoteRequest {
  noteId: string;
}

export interface ClassifyNoteResponse {
  noteId: string;
  topics: Array<{
    topicId: string;
    topicName: string;
    confidence: number;
  }>;
}

export interface ClassifyAllRequest {
  excludeJournal?: boolean;
}

export interface ClassifyAllResponse {
  processed: number;
  total: number;
  failed: number;
}

export interface TopicSemanticSearchRequest {
  query: string;
  limit?: number;
}

export interface TopicSemanticSearchResponse {
  results: Array<{
    noteId: string;
    title: string;
    similarity: number;
  }>;
}

export interface GetSimilarNotesRequest {
  noteId: string;
  limit?: number;
}

export interface GetSimilarNotesResponse {
  similar: Array<{
    noteId: string;
    title: string;
    similarity: number;
  }>;
}

export interface GetEmbeddingStatusResponse {
  ready: boolean;
  totalNotes: number;
  embeddedNotes: number;
  pendingNotes: number;
}

// Use case interfaces
export interface ICreateTopicUseCase {
  execute(request: CreateTopicRequest): Promise<CreateTopicResponse>;
}

export interface IUpdateTopicUseCase {
  execute(request: UpdateTopicRequest): Promise<UpdateTopicResponse>;
}

export interface IDeleteTopicUseCase {
  execute(request: DeleteTopicRequest): Promise<void>;
}

export interface IListTopicsUseCase {
  execute(request: ListTopicsRequest): Promise<ListTopicsResponse>;
}

export interface IGetTopicUseCase {
  execute(request: GetTopicRequest): Promise<GetTopicResponse>;
}

export interface IGetNotesForTopicUseCase {
  execute(request: GetNotesForTopicRequest): Promise<GetNotesForTopicResponse>;
}

export interface IGetTopicsForNoteUseCase {
  execute(request: GetTopicsForNoteRequest): Promise<GetTopicsForNoteResponse>;
}

export interface IAssignTopicUseCase {
  execute(request: AssignTopicRequest): Promise<void>;
}

export interface IRemoveTopicUseCase {
  execute(request: RemoveTopicRequest): Promise<void>;
}

export interface IClassifyNoteUseCase {
  execute(request: ClassifyNoteRequest): Promise<ClassifyNoteResponse>;
}

export interface IClassifyAllUseCase {
  execute(request: ClassifyAllRequest): Promise<ClassifyAllResponse>;
}

export interface ITopicSemanticSearchUseCase {
  execute(request: TopicSemanticSearchRequest): Promise<TopicSemanticSearchResponse>;
}

export interface IGetSimilarNotesUseCase {
  execute(request: GetSimilarNotesRequest): Promise<GetSimilarNotesResponse>;
}

export interface IRecomputeCentroidsUseCase {
  execute(): Promise<void>;
}

export interface IGetEmbeddingStatusUseCase {
  execute(): Promise<GetEmbeddingStatusResponse>;
}

export interface IInitializeTopicsUseCase {
  execute(): Promise<{ success: boolean; ready: boolean }>;
}
