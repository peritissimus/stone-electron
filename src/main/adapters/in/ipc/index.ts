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

// Task management
export {
  registerTaskHandlers,
  unregisterTaskHandlers,
  type TaskIPCDeps,
} from './TaskIPC';

// Topic classification
export {
  registerTopicHandlers,
  unregisterTopicHandlers,
  type TopicIPCDeps,
} from './TopicIPC';

// Graph and links
export {
  registerGraphHandlers,
  unregisterGraphHandlers,
  type GraphIPCDeps,
} from './GraphIPC';

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
export {
  registerExportHandlers,
  unregisterExportHandlers,
  type ExportIPCDeps,
} from './ExportIPC';

// Git operations
export {
  registerGitHandlers,
  unregisterGitHandlers,
  type GitIPCDeps,
} from './GitIPC';

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

// System utilities
export {
  registerSystemHandlers,
  unregisterSystemHandlers,
  type SystemIPCDeps,
} from './SystemIPC';

// Settings
export {
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  type SettingsIPCDeps,
} from './SettingsIPC';
