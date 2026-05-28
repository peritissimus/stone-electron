/**
 * Application Use Cases Index
 *
 * Export all use case implementations and factories.
 * All use cases are organized flat at this level for consistency.
 */

// Note Use Cases
export {
  CreateNoteUseCase,
  UpdateNoteUseCase,
  GetNoteUseCase,
  ListNotesUseCase,
  DeleteNoteUseCase,
  RestoreNoteUseCase,
  MoveNoteUseCase,
  SearchNotesUseCase,
  GetNoteContentUseCase,
  SaveNoteContentUseCase,
  GetNoteByPathUseCase,
  ToggleFavoriteUseCase,
  TogglePinUseCase,
  ToggleArchiveUseCase,
  createNoteUseCases,
  type NoteUseCasesDeps,
} from './note';

// Notebook Use Cases
export {
  CreateNotebookUseCase,
  UpdateNotebookUseCase,
  GetNotebookUseCase,
  ListNotebooksUseCase,
  DeleteNotebookUseCase,
  MoveNotebookUseCase,
  createNotebookUseCases,
} from './notebook';

// Workspace Use Cases
export {
  CreateWorkspaceUseCase,
  GetWorkspaceUseCase,
  ListWorkspacesUseCase,
  SetActiveWorkspaceUseCase,
  GetActiveWorkspaceUseCase,
  DeleteWorkspaceUseCase,
  UpdateWorkspaceUseCase,
  SelectFolderUseCase,
  ValidatePathUseCase,
  CreateFolderUseCase,
  RenameFolderUseCase,
  DeleteFolderUseCase,
  MoveFolderUseCase,
  ScanWorkspaceUseCase,
  SyncWorkspaceUseCase,
  createWorkspaceUseCases,
  type WorkspaceUseCasesDeps,
} from './workspace';

// Tag Use Cases
export {
  CreateTagUseCase,
  UpdateTagUseCase,
  GetTagUseCase,
  ListTagsUseCase,
  DeleteTagUseCase,
  AddTagToNoteUseCase,
  RemoveTagFromNoteUseCase,
  GetNoteTagsUseCase,
  createTagUseCases,
} from './tag';

// Search Use Cases
export {
  FullTextSearchUseCase,
  SemanticSearchUseCase,
  FindSimilarNotesUseCase,
  createSearchUseCases,
} from './search';

// AI Use Cases
export {
  AskNotesUseCase,
  SummarizeNoteUseCase,
  SuggestLinksUseCase,
  createAIUseCases,
  type AIUseCasesDeps,
} from './ai';

// Index Use Cases (chunk + embed)
export {
  IndexNoteUseCase,
  RebuildAllNotesIndexUseCase,
  GetIndexStatsUseCase,
  createIndexUseCases,
  type IndexUseCasesDeps,
} from './indexing';

// Task Use Cases
export { createTaskUseCases, type TaskUseCasesDeps } from './task';

// Graph Use Cases
export { createGraphUseCases, type GraphUseCasesDeps } from './graph';

// Version Use Cases
export { createVersionUseCases, type VersionUseCasesDeps } from './version';

// Topic Use Cases
export {
  InitializeTopicsUseCase,
  GetAllTopicsUseCase,
  GetTopicByIdUseCase,
  CreateTopicUseCase,
  UpdateTopicUseCase,
  DeleteTopicUseCase,
  ClassifyNoteUseCase,
  ClassifyAllNotesUseCase,
  AssignTopicToNoteUseCase,
  RemoveTopicFromNoteUseCase,
  GetTopicSimilarNotesUseCase,
  TopicSemanticSearchUseCase,
  RecomputeCentroidsUseCase,
  GetEmbeddingStatusUseCase,
  GetNotesForTopicUseCase,
  GetTopicsForNoteUseCase,
  createTopicUseCases,
  type TopicUseCasesDeps,
} from './topic';

// Attachment Use Cases
export { createAttachmentUseCases, type AttachmentUseCasesDeps } from './attachment';

// Git Use Cases
export {
  GetGitStatusUseCase,
  InitGitRepoUseCase,
  GitCommitUseCase,
  GitPullUseCase,
  GitPushUseCase,
  GitSyncUseCase,
  SetGitRemoteUseCase,
  GetGitCommitsUseCase,
  createGitUseCases,
  type GitUseCasesDeps,
} from './git';

// Database Use Cases
export {
  GetDatabaseStatusUseCase,
  VacuumDatabaseUseCase,
  CheckDatabaseIntegrityUseCase,
  createDatabaseUseCases,
  type DatabaseUseCasesDeps,
  type DatabaseManager,
} from './database';

// Quick Capture Use Cases
export { createQuickCaptureUseCases, type QuickCaptureUseCasesDeps } from './quickCapture';

// Journal Use Cases
export {
  OpenOrCreateJournalForDateUseCase,
  createJournalUseCases,
  type JournalUseCasesDeps,
} from './journal';

// Quick Note (slot-based) Use Cases
export {
  CreateQuickNoteUseCase,
  createQuickNoteUseCases,
  type QuickNoteUseCasesDeps,
} from './quickNote';

// Scratch Editor Use Cases
export {
  PickScratchFileUseCase,
  ReadScratchFileUseCase,
  WriteScratchFileUseCase,
  createScratchUseCases,
  type ScratchUseCasesDeps,
} from './scratch';

// Export Use Cases
export { createExportUseCases, type ExportUseCasesDeps } from './export';

// System Use Cases
export {
  GetSystemFontsUseCase,
  ShowFolderPickerUseCase,
  ValidateSystemPathUseCase,
  OpenInFolderUseCase,
  OpenExternalUseCase,
  createSystemUseCases,
  type SystemUseCasesDeps,
} from './system';

// Settings Use Cases
export {
  GetSettingUseCase,
  SetSettingUseCase,
  GetAllSettingsUseCase,
  GetAppearanceSettingsUseCase,
  SetThemeUseCase,
  SetAccentColorUseCase,
  UpdateFontSettingsUseCase,
  ResetFontSettingsUseCase,
  createSettingsUseCases,
  type SettingsUseCasesDeps,
} from './settings';

// Meeting Use Cases
export {
  ReserveRecordingSlotUseCase,
  AppendRecordingAudioUseCase,
  FinalizeRecordingUseCase,
  ListMeetingRecordingsUseCase,
  GetMeetingRecordingUseCase,
  DeleteMeetingRecordingUseCase,
  ResummarizeMeetingUseCase,
  SendToJournalUseCase,
  createMeetingUseCases,
  type MeetingUseCasesDeps,
  RECORDINGS_DIR,
} from './meeting';

// Template Use Cases
export {
  ListTemplatesUseCase,
  CreateNoteFromTemplateUseCase,
  createTemplateUseCases,
  type TemplateUseCasesDeps,
} from './template';
