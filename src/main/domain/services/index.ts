/**
 * Domain Services - Pure business logic without I/O
 */

export { TaskExtractor, TASK_PATTERN, VALID_TASK_STATES } from './TaskExtractor';
export type { TaskState, RawTask } from './TaskExtractor';

export { LinkExtractor } from './LinkExtractor';
export type { LinkType, ExtractedLink } from './LinkExtractor';

export { SimilarityCalculator } from './SimilarityCalculator';
export type { EmbeddingVector, SimilarityResult } from './SimilarityCalculator';

export { TopicClassifier, TOPIC_CONFIDENCE_THRESHOLD } from './TopicClassifier';
export type { TopicCandidate, TopicMatch } from './TopicClassifier';

export {
  SearchRanker,
  DEFAULT_FTS_WEIGHT,
  DEFAULT_SEMANTIC_WEIGHT,
  DEFAULT_SINGLE_SOURCE_SCORE,
} from './SearchRanker';

export { WorkspaceDiffer } from './WorkspaceDiffer';
export type {
  FsEntry,
  DbEntry,
  AddedEntry,
  ModifiedEntry,
  UnchangedEntry,
  RemovedEntry,
  WorkspaceDiffPlan,
} from './WorkspaceDiffer';

export { VersionDiffer } from './VersionDiffer';

export { NoteGraphBuilder } from './NoteGraphBuilder';
export { stripFirstHeading } from './MarkdownTitle';
export {
  canonicalizeChord,
  detectConflicts,
  formatChord,
  isReservedChord,
  parseChord,
  resolveShortcuts,
  validateChord,
} from './ShortcutRules';
export type {
  ParsedChord,
  ResolvedBinding,
  ResolvedShortcuts,
  ShortcutConflict,
} from './ShortcutRules';
