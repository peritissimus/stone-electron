/**
 * Wire types for the topic-suggestion flow. Defined here so both the api/
 * layer and renderer components can reference them without crossing the
 * renderer architecture boundary.
 */

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
  /** Mean cosine of cluster members to the cluster centroid, in [0, 1]. */
  cohesion: number;
  representatives: SuggestedTopicRepresentative[];
}
