/**
 * Zod Schemas for API Response Validation
 *
 * This file contains Zod schemas for validating all API responses
 * to ensure type safety at runtime.
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const IpcResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
  });

// ============================================================================
// Entity Schemas
// ============================================================================

// NoteSchema and NoteWithMetaSchema have been promoted to the shared IPC
// wire-schema layer (src/shared/schemas/notes.ts) so main and renderer
// share a single source of truth. Re-export keeps existing callers working.
export { NoteSchema, NoteWithMetaSchema } from '@shared/schemas';

// NotebookSchema and NotebookWithCountSchema are promoted to the shared IPC
// wire-schema layer (src/shared/schemas/notebooks.ts).
export { NotebookSchema, NotebookWithCountSchema } from '@shared/schemas';

// TagSchema and TagWithCountSchema are promoted to the shared IPC
// wire-schema layer (src/shared/schemas/tags.ts).
export { TagSchema, TagWithCountSchema } from '@shared/schemas';

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.union([z.string(), z.date(), z.number()]),
  updatedAt: z.union([z.string(), z.date(), z.number()]),
});

export const TopicWithCountSchema = TopicSchema.extend({
  noteCount: z.number(),
});

export const ClassificationResultSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  confidence: z.number(),
});

export const SimilarNoteSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  distance: z.number(),
});

// WorkspaceSchema is promoted to the shared IPC wire-schema layer
// (src/shared/schemas/workspace.ts).
export { WorkspaceSchema } from '@shared/schemas';

export const AttachmentSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  filename: z.string(),
  path: z.string(),
  mimeType: z.string().nullable(),
  size: z.number().nullable(),
  createdAt: z.union([z.string(), z.date(), z.number()]),
});

export const TodoItemSchema = z.object({
  id: z.string(),
  noteId: z.string(), // Accept plain string, will be cast to UUID
  noteTitle: z.string().nullable(),
  notePath: z.string().nullable(),
  text: z.string(),
  state: z.enum(['todo', 'doing', 'waiting', 'hold', 'done', 'canceled', 'idea']),
  checked: z.boolean(),
  createdAt: z.union([z.string(), z.date(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.date(), z.number()]).optional(),
}) as z.ZodType<any>; // Cast to avoid UUID brand check

export const SettingsSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.number(),
});

export const FontSettingsSchema = z.object({
  uiFont: z.string(),
  uiFontSize: z.number(),
  editorHeadingFont: z.string(),
  editorBodyFont: z.string(),
  editorFontSize: z.number(),
  editorLineHeight: z.number(),
  monoFont: z.string(),
  monoFontSize: z.number(),
});

export const AppearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  accentColor: z.enum(['blue', 'purple', 'pink', 'red', 'orange', 'green', 'teal']),
  fontSettings: FontSettingsSchema,
});

// ----- editor settings (mirrors src/shared/types/settings.ts EditorSettings) -----

export const EditorBehaviorConfigSchema = z.object({
  placeholder: z.string(),
  defaultMode: z.enum(['rich', 'raw']),
});

export const EditorIndentConfigSchema = z.object({
  types: z.array(z.string()),
  maxIndent: z.number().int().nonnegative(),
});

export const EditorTableConfigSchema = z.object({
  resizable: z.boolean(),
  allowNodeSelection: z.boolean(),
});

export const EditorTaskStateDefSchema = z.object({
  value: z.string(),
  label: z.string(),
  shortLabel: z.string().optional(),
  done: z.boolean().optional(),
});

export const EditorTaskConfigSchema = z.object({
  states: z.array(EditorTaskStateDefSchema),
  defaultState: z.string(),
  doneStates: z.array(z.string()),
  nested: z.boolean(),
});

export const EditorCodeBlockConfigSchema = z.object({
  preloadLanguages: z.array(z.string()),
});

export const EditorSettingsSchema = z.object({
  behavior: EditorBehaviorConfigSchema,
  indent: EditorIndentConfigSchema,
  table: EditorTableConfigSchema,
  task: EditorTaskConfigSchema,
  codeBlock: EditorCodeBlockConfigSchema,
});

// ----- shortcuts -----

const ChordOrChordsSchema = z.union([z.string(), z.array(z.string())]);

export const ShortcutsConfigSchema = z.object({
  app: z.record(ChordOrChordsSchema),
  editor: z.record(ChordOrChordsSchema),
});

// ----- AI settings -----

export const AIConfigSchema = z.object({
  indexing: z.object({
    enabled: z.boolean(),
    providerMode: z.enum(['local', 'cloud', 'disabled']),
    chunkMaxCharacters: z.number().int().positive(),
    chunkOverlapCharacters: z.number().int().nonnegative(),
    batchSize: z.number().int().positive(),
    autoIndexOnSave: z.boolean(),
  }),
  models: z.object({
    textModel: z.string(),
    embeddingModel: z.string(),
    openaiBaseUrl: z.string(),
  }),
  privacy: z.object({
    allowCloudInference: z.boolean(),
    allowSendingNoteContent: z.boolean(),
    allowSendingMetadata: z.boolean(),
  }),
});

export const AIProviderKeyStatusSchema = z.object({
  provider: z.enum(['openai', 'azure', 'google', 'groq']),
  label: z.string(),
  envVar: z.string(),
  hasEnvKey: z.boolean(),
  hasStoredKey: z.boolean(),
  available: z.boolean(),
  activeSource: z.enum(['env', 'stored']).nullable(),
});

// ----- meetings settings -----

export const MeetingsConfigSchema = z.object({
  audioRetentionDays: z.number().int(),
});

// ============================================================================
// Search Schemas
// ============================================================================

export const SearchResultSchema = z.object({
  id: z.string(), // Accept plain string, will be cast to UUID
  title: z.string(),
  notebookId: z.string().nullable(),
  relevance: z.number().optional(),
  similarity: z.number().optional(),
  score: z.number().optional(),
  title_highlight: z.string().optional(),
  search_type: z.enum(['fts', 'semantic', 'hybrid']).optional(),
}) as z.ZodType<any>; // Cast to avoid UUID brand check

export const SearchResultsSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number(),
  query_time_ms: z.number(),
});

// ============================================================================
// Git Schemas
// ============================================================================

export const GitStatusSchema = z.object({
  isRepo: z.boolean(),
  branch: z.string().nullable(),
  hasRemote: z.boolean(),
  remoteUrl: z.string().nullable(),
  ahead: z.number(),
  behind: z.number(),
  staged: z.number(),
  unstaged: z.number(),
  untracked: z.number(),
  hasChanges: z.boolean(),
  lastSyncAt: z.string().nullable().optional(),
});

export const GitCommitResultSchema = z.object({
  success: z.boolean(),
  hash: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const GitSyncResultSchema = z.object({
  success: z.boolean(),
  committed: z.boolean().optional(),
  pulled: z.number().optional(),
  pushed: z.number().optional(),
  conflicts: z.array(z.string()).optional(),
  errorKind: z.enum(['auth', 'network', 'conflict', 'unknown']).optional(),
  error: z.string().optional(),
});

export const GitCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
});

// ============================================================================
// Performance Schemas
// ============================================================================

export const StartupMetricsSchema = z.object({
  appStartTime: z.number(),
  dbInitTime: z.number().optional(),
  containerInitTime: z.number().optional(),
  ipcRegistrationTime: z.number().optional(),
  windowCreationTime: z.number().optional(),
  totalStartupTime: z.number().optional(),
  windowReadyTime: z.number().optional(),
});

export const MemoryMetricsSchema = z.object({
  heapUsed: z.number(),
  heapTotal: z.number(),
  external: z.number(),
  rss: z.number(),
  arrayBuffers: z.number(),
  heapUsedMB: z.number(),
  rssMB: z.number(),
});

export const CPUMetricsSchema = z.object({
  user: z.number(),
  system: z.number(),
  percentCPU: z.number(),
});

export const EventLoopMetricsSchema = z.object({
  lagMs: z.number(),
  utilizationPercent: z.number(),
});

export const ChannelStatsSchema = z.object({
  calls: z.number(),
  errors: z.number(),
  totalDurationMs: z.number(),
  avgDurationMs: z.number(),
  minDurationMs: z.number(),
  maxDurationMs: z.number(),
});

export const IPCMetricsSchema = z.object({
  totalCalls: z.number(),
  totalErrors: z.number(),
  avgDurationMs: z.number(),
  p50DurationMs: z.number(),
  p95DurationMs: z.number(),
  p99DurationMs: z.number(),
  callsByChannel: z.record(ChannelStatsSchema),
});

export const OperationStatsSchema = z.object({
  count: z.number(),
  errors: z.number(),
  totalDurationMs: z.number(),
  avgDurationMs: z.number(),
  minDurationMs: z.number(),
  maxDurationMs: z.number(),
});

export const DatabaseMetricsSchema = z.object({
  totalQueries: z.number(),
  totalErrors: z.number(),
  avgDurationMs: z.number(),
  slowQueries: z.number(),
  queriesByOperation: z.record(OperationStatsSchema),
});

export const RendererMemoryMetricsSchema = z.object({
  usedJSHeapSize: z.number(),
  totalJSHeapSize: z.number(),
  jsHeapSizeLimit: z.number(),
});

export const RendererNavigationMetricsSchema = z.object({
  domContentLoaded: z.number(),
  loadComplete: z.number(),
  domInteractive: z.number(),
});

export const LongTaskEntrySchema = z.object({
  name: z.string(),
  startTime: z.number(),
  duration: z.number(),
});

export const RendererMetricsSchema = z.object({
  memory: RendererMemoryMetricsSchema,
  navigation: RendererNavigationMetricsSchema,
  fps: z.number().nullable(),
  longTasks: z.array(LongTaskEntrySchema),
});

export const PerformanceSnapshotSchema = z.object({
  timestamp: z.number(),
  uptime: z.number(),
  startup: StartupMetricsSchema,
  memory: MemoryMetricsSchema,
  cpu: CPUMetricsSchema,
  eventLoop: EventLoopMetricsSchema,
  ipc: IPCMetricsSchema,
  database: DatabaseMetricsSchema,
  renderer: RendererMetricsSchema.nullable().optional(),
});

// Database schemas are promoted to the shared IPC wire-schema layer
// (src/shared/schemas/database.ts).
export {
  DatabaseStatusResponseSchema as DatabaseStatusSchema,
  VacuumDatabaseResponseSchema as VacuumResultSchema,
  CheckDatabaseIntegrityResponseSchema as IntegrityResultSchema,
} from '@shared/schemas';

// ============================================================================
// Workspace Schemas
// ============================================================================

export const FileTreeNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'folder']),
    children: z.array(FileTreeNodeSchema).optional(),
    noteId: z.string().optional(),
  }),
);

// ============================================================================
// Graph Schemas
// ============================================================================

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['note', 'notebook', 'tag', 'topic']),
  metadata: z.record(z.unknown()).optional(),
});

export const GraphLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['link', 'reference', 'tag', 'topic', 'parent']),
  weight: z.number().optional(),
});

// Legacy alias for backwards compatibility
export const GraphEdgeSchema = GraphLinkSchema;

export const GraphDataSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  links: z.array(GraphLinkSchema),
});

// ============================================================================
// Topic/Embedding Schemas
// ============================================================================

export const EmbeddingStatusSchema = z.object({
  ready: z.boolean(),
  totalNotes: z.number(),
  embeddedNotes: z.number(),
  pendingNotes: z.number(),
});

export const NoteTopicDetailsSchema = z.object({
  noteId: z.string(),
  topicId: z.string(),
  confidence: z.number(),
  isManual: z.boolean(),
  createdAt: z.string(),
  topicName: z.string(),
  topicColor: z.string(),
});
