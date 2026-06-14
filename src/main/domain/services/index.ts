/**
 * Domain Services - Pure business logic without I/O
 */

export { TaskExtractor, TASK_PATTERN, VALID_TASK_STATES } from './TaskExtractor';
export type { TaskState, RawTask } from './TaskExtractor';

export { LinkExtractor } from './LinkExtractor';
export type { LinkType, ExtractedLink } from './LinkExtractor';

export { SimilarityCalculator } from './SimilarityCalculator';
export type { EmbeddingVector, SimilarityResult } from './SimilarityCalculator';

export { RelatedNotesScorer } from './RelatedNotesScorer';
export type {
  AlignableChunk,
  SemanticCandidate,
  StructuralSignals,
} from './RelatedNotesScorer';

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

export { NoteChunker } from './NoteChunker';
export type { Chunk, ChunkOptions } from './NoteChunker';

export { hashText } from './hashText';

export { DEFAULT_MEETING_SUMMARY_PROMPT } from './meetingSummaryPrompts';

export { TemplateRenderer, type TemplateRenderContext } from './TemplateRenderer';

export { DEFAULT_STATUS_REPORT_PROMPT } from './statusReportPrompts';

export { TopicSuggester } from './TopicSuggester';
export type {
  SuggesterChunk,
  SuggesterOptions,
  SuggestedCluster,
} from './TopicSuggester';

export { NoteGraphBuilder } from './NoteGraphBuilder';
export { stripFirstHeading } from './MarkdownTitle';
export { collapseRepeatedSegments } from './transcriptRepeats';
export {
  buildTranscriptText,
  buildSummaryTranscript,
  confidenceBand,
  CONFIDENCE_MED_MIN,
  CONFIDENCE_HIGH_MIN,
  type ConfidenceBand,
} from './transcriptFormat';
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
