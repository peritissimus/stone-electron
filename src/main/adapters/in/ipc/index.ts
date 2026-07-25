/**
 * IPC Adapters Index
 *
 * Primary/driving adapters for Electron IPC.
 */

// Core note operations
export { registerNoteHandlers, unregisterNoteHandlers, type NoteIPCDeps } from './NoteIPC';
export {
  registerNotebookHandlers,
  unregisterNotebookHandlers,
  type NotebookIPCDeps,
} from './NotebookIPC';
export {
  registerWorkspaceHandlers,
  unregisterWorkspaceHandlers,
  type WorkspaceIPCDeps,
} from './WorkspaceIPC';
export { registerTagHandlers, unregisterTagHandlers, type TagIPCDeps } from './TagIPC';
export {
  registerSearchHandlers,
  unregisterSearchHandlers,
  type SearchIPCDeps,
  type RunSearchEffect,
} from './SearchIPC';

// AI-assisted PKM
export {
  registerAIHandlers,
  unregisterAIHandlers,
  type AIIPCDeps,
  type RunAIEffect,
} from './AIIPC';

// Chunk-level index
export { registerIndexHandlers, unregisterIndexHandlers, type IndexIPCDeps } from './IndexIPC';

// Task management
export {
  registerTaskHandlers,
  unregisterTaskHandlers,
  type TaskIPCDeps,
  type RunTaskEffect,
} from './TaskIPC';

// Topic classification
export { registerTopicHandlers, unregisterTopicHandlers, type TopicIPCDeps } from './TopicIPC';

// Graph and links
export {
  registerGraphHandlers,
  unregisterGraphHandlers,
  type GraphIPCDeps,
  type RunGraphEffect,
} from './GraphIPC';

// Version history
export {
  registerVersionHandlers,
  unregisterVersionHandlers,
  type VersionIPCDeps,
  type RunVersionEffect,
} from './VersionIPC';

// Attachments
export {
  registerAttachmentHandlers,
  unregisterAttachmentHandlers,
  type AttachmentIPCDeps,
  type RunAttachmentEffect,
} from './AttachmentIPC';

// Export operations
export {
  registerExportHandlers,
  unregisterExportHandlers,
  type ExportIPCDeps,
  type RunExportEffect,
} from './ExportIPC';

// Git operations
export { registerGitHandlers, unregisterGitHandlers, type GitIPCDeps } from './GitIPC';

// Database maintenance
export {
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
  type DatabaseIPCDeps,
  type RunDatabaseEffect,
} from './DatabaseIPC';

// Quick capture
export {
  registerQuickCaptureHandlers,
  unregisterQuickCaptureHandlers,
  type QuickCaptureIPCDeps,
  type RunQuickCaptureEffect,
} from './QuickCaptureIPC';

// Journal destination
export {
  registerJournalHandlers,
  unregisterJournalHandlers,
  type JournalIPCDeps,
  type RunJournalEffect,
} from './JournalIPC';

// Quick notes (slot-based)
export {
  registerQuickNoteHandlers,
  unregisterQuickNoteHandlers,
  type QuickNoteIPCDeps,
  type RunQuickNoteEffect,
} from './QuickNoteIPC';

// Scratch editor (open arbitrary .md files)
export {
  registerScratchHandlers,
  unregisterScratchHandlers,
  type ScratchIPCDeps,
  type RunScratchEffect,
} from './ScratchIPC';

// System utilities
export { registerSystemHandlers, unregisterSystemHandlers, type SystemIPCDeps } from './SystemIPC';

// Settings
export {
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  type SettingsIPCDeps,
} from './SettingsIPC';

// Performance monitoring
export {
  registerPerformanceHandlers,
  unregisterPerformanceHandlers,
  setMainWindow,
  type PerformanceIPCDeps,
} from './PerformanceIPC';

// Meeting recorder
export {
  registerMeetingHandlers,
  unregisterMeetingHandlers,
  type MeetingIPCDeps,
} from './MeetingIPC';

// Templates
export {
  registerTemplateHandlers,
  unregisterTemplateHandlers,
  type TemplateIPCDeps,
  type RunTemplateEffect,
} from './TemplateIPC';

// Daily Review
export {
  registerDailyReviewHandlers,
  unregisterDailyReviewHandlers,
  type DailyReviewIPCDeps,
} from './DailyReviewIPC';

// Status Report
export {
  registerStatusReportHandlers,
  unregisterStatusReportHandlers,
  type StatusReportIPCDeps,
  type RunStatusReportEffect,
} from './StatusReportIPC';
