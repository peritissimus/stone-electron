/**
 * API Layer - Centralized IPC channel wrappers
 *
 * Implements: specs/api.ts#API
 *
 * This module provides a clean abstraction over IPC communication.
 * All API functions are pure - no React, no stores, no side effects.
 *
 * Usage:
 * ```typescript
 * import { noteAPI, tagAPI, workspaceAPI } from '@renderer/api';
 *
 * // In a hook or component
 * const response = await noteAPI.getAll({ notebook_id: '123' });
 * if (response.success) {
 *   setNotes(response.data.notes);
 * }
 * ```
 *
 * Architecture:
 * - Transport: lib/ipc.ts (invokeIpc, handleIpcResponse)
 * - API: api/*.ts (channel wrappers) <- YOU ARE HERE
 * - Hooks: hooks/use*API.ts (React + store integration)
 * - Components: components/*.tsx (UI only, uses hooks)
 */

// Entity APIs
export { noteAPI } from './noteAPI';
export type { NoteWithMeta, GetAllNotesParams, GraphData } from './noteAPI';

export { notebookAPI } from './notebookAPI';
export type { NotebookWithCount, GetAllNotebooksParams } from './notebookAPI';

export { tagAPI } from './tagAPI';
export type { GetAllTagsParams } from './tagAPI';

export { topicAPI } from './topicAPI';

export { workspaceAPI } from './workspaceAPI';
export type { FileTreeNode } from './workspaceAPI';

// Operation APIs
export { searchAPI } from './searchAPI';
export type { SearchParams, DateRangeParams } from './searchAPI';

export { attachmentAPI } from './attachmentAPI';

// Settings & System APIs
export { settingsAPI, databaseAPI, systemAPI } from './settingsAPI';

// Git API
export { gitAPI } from './gitAPI';
export type { GitStatus, GitCommitResult, GitSyncResult, GitCommit } from './gitAPI';

// Quick Capture API
export { quickCaptureAPI } from './quickCaptureAPI';

// Performance Monitoring API
export { performanceAPI } from './performanceAPI';
export type {
  PerformanceSnapshot,
  StartupMetrics,
  MemoryMetrics,
  CPUMetrics,
  EventLoopMetrics,
  IPCMetrics,
  DatabaseMetrics,
  RendererMetrics,
  ChannelStats,
  OperationStats,
  LongTaskEntry,
} from './performanceAPI';
