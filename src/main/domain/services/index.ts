/**
 * Domain Services - Pure business logic without I/O
 */

export { TaskExtractor, TASK_PATTERN, VALID_TASK_STATES } from './TaskExtractor';
export type { TaskState, RawTask } from './TaskExtractor';

export { LinkExtractor } from './LinkExtractor';
export type { LinkType, ExtractedLink } from './LinkExtractor';

export { SimilarityCalculator } from './SimilarityCalculator';
export type { EmbeddingVector, SimilarityResult } from './SimilarityCalculator';
