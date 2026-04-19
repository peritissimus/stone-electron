/**
 * TopicClassifier - Pure domain service for scoring a note embedding against topic centroids.
 *
 * Encapsulates the business rule for how notes are classified into topics:
 * - cosine similarity against each topic's centroid
 * - must exceed the confidence threshold to count as a match
 * - matches are returned sorted by confidence descending
 */

import { SimilarityCalculator } from './SimilarityCalculator';

export const TOPIC_CONFIDENCE_THRESHOLD = 0.5;

export interface TopicCandidate {
  topicId: string;
  topicName: string;
  centroid: number[];
}

export interface TopicMatch {
  topicId: string;
  topicName: string;
  confidence: number;
}

export const TopicClassifier = {
  classify(
    embedding: number[],
    candidates: TopicCandidate[],
    threshold: number = TOPIC_CONFIDENCE_THRESHOLD,
  ): TopicMatch[] {
    const matches: TopicMatch[] = [];

    for (const candidate of candidates) {
      const confidence = SimilarityCalculator.cosineSimilarity(embedding, candidate.centroid);
      if (confidence > threshold) {
        matches.push({
          topicId: candidate.topicId,
          topicName: candidate.topicName,
          confidence,
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
  },
};
