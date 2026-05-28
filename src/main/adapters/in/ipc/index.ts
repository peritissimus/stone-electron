/**
 * IPC Adapters Index
 *
 * Primary/driving adapters for Electron IPC.
 */

// Core note operations
export { NoteIPC, type NoteIPCDeps } from './NoteIPC';
export { NotebookIPC, type NotebookIPCDeps } from './NotebookIPC';
export { WorkspaceIPC, type WorkspaceIPCDeps } from './WorkspaceIPC';
export { TagIPC, type TagIPCDeps } from './TagIPC';
export { SearchIPC, type SearchIPCDeps } from './SearchIPC';

// AI-assisted PKM
export { registerAIHandlers, unregisterAIHandlers, type AIIPCDeps } from './AIIPC';

// Chunk-level index
export { registerIndexHandlers, unregisterIndexHandlers, type IndexIPCDeps } from './IndexIPC';

// Task management
export { registerTaskHandlers, unregisterTaskHandlers, type TaskIPCDeps } from './TaskIPC';

// Topic classification
export { registerTopicHandlers, unregisterTopicHandlers, type TopicIPCDeps } from './TopicIPC';

// Graph and links
export { registerGraphHandlers, unregisterGraphHandlers, type GraphIPCDeps } from './GraphIPC';

// Version history
export {
  registerVersionHandlers,
  unregisterVersionHandlers,
  type VersionIPCDeps,
} from './VersionIPC';

// Attachments
export {
  registerAttachmentHandlers,
  unregisterAttachmentHandlers,
  type AttachmentIPCDeps,
} from './AttachmentIPC';

// Export operations
export { registerExportHandlers, unregisterExportHandlers, type ExportIPCDeps } from './ExportIPC';

// Git operations
export { registerGitHandlers, unregisterGitHandlers, type GitIPCDeps } from './GitIPC';

// Database maintenance
export {
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
  type DatabaseIPCDeps,
} from './DatabaseIPC';

// Quick capture
export {
  registerQuickCaptureHandlers,
  unregisterQuickCaptureHandlers,
  type QuickCaptureIPCDeps,
} from './QuickCaptureIPC';

// Journal destination
export {
  registerJournalHandlers,
  unregisterJournalHandlers,
  type JournalIPCDeps,
} from './JournalIPC';

// Quick notes (slot-based)
export {
  registerQuickNoteHandlers,
  unregisterQuickNoteHandlers,
  type QuickNoteIPCDeps,
} from './QuickNoteIPC';

// Scratch editor (open arbitrary .md files)
export {
  registerScratchHandlers,
  unregisterScratchHandlers,
  type ScratchIPCDeps,
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
} from './TemplateIPC';
