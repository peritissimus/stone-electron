/**
 * Application Use Cases Index
 *
 * Export all use case implementations and factories.
 * All use cases are organized flat at this level for consistency.
 */

// Note Use Cases
export { NoteUseCasesLive } from './note';

// Notebook Use Cases
export { NotebookUseCasesLive } from './notebook';

// Workspace Use Cases
export { WorkspaceUseCasesLive } from './workspace';

// Tag Use Cases
export { TagUseCasesLive } from './tag';

// Search Use Cases
export { SearchUseCasesLive } from './search';

// AI Use Cases
export { AIUseCasesLive } from './ai';

// Index Use Cases (chunk + embed)
export { IndexUseCasesLive } from './indexing';

// Task Use Cases
export { TaskUseCasesLive } from './task';

// Graph Use Cases
export { GraphUseCasesLive } from './graph';

// Version Use Cases
export { VersionUseCasesLive } from './version';

// Topic Use Cases
export { TopicUseCasesLive } from './topic';

// Attachment Use Cases
export { AttachmentUseCasesLive } from './attachment';

// Git Use Cases
export { GitUseCasesLive, lastSyncSettingKey } from './git';

// Database Use Cases
export { DatabaseUseCasesLive } from './database';

// Quick Capture Use Cases
export { QuickCaptureUseCasesLive } from './quickCapture';

// Journal Use Cases
export { JournalUseCasesLive } from './journal';

// Quick Note (slot-based) Use Cases
export { QuickNoteUseCasesLive } from './quickNote';

// Scratch Editor Use Cases
export { ScratchUseCasesLive } from './scratch';

// Export Use Cases
export { ExportUseCasesLive } from './export';

// System Use Cases
export { SystemUseCasesLive } from './system';

// Settings Use Cases
export { SettingsUseCasesLive } from './settings';

// Meeting Use Cases
export {
  MEETING_FINALIZE_JOB,
  MeetingUseCasesLive,
  makeMeetingUseCasesLayer,
  RECORDINGS_DIR,
} from './meeting';

// Template Use Cases
export { TemplateUseCasesLive } from './template';

// Daily Review Use Cases
export { DailyReviewUseCasesLive } from './dailyReview';

// Status Report Use Cases
export {
  StatusReportUseCasesLive,
} from './statusReport';
