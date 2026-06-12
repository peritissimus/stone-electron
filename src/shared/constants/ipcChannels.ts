/**
 * IPC Channel Constants for Stone Application
 */

// Workspace Operations
export const WORKSPACE_CHANNELS = {
  CREATE: 'workspaces:create',
  UPDATE: 'workspaces:update',
  DELETE: 'workspaces:delete',
  GET_ALL: 'workspaces:getAll',
  GET_ACTIVE: 'workspaces:getActive',
  SET_ACTIVE: 'workspaces:setActive',
  SCAN: 'workspaces:scan',
  SYNC: 'workspaces:sync',
  CREATE_FOLDER: 'workspaces:createFolder',
  RENAME_FOLDER: 'workspaces:renameFolder',
  DELETE_FOLDER: 'workspaces:deleteFolder',
  MOVE_FOLDER: 'workspaces:moveFolder',
  VALIDATE_PATH: 'workspaces:validatePath',
  SELECT_FOLDER: 'workspaces:selectFolder',
  GET_DEFAULT_PATH: 'workspaces:getDefaultPath',
} as const;

// Note Operations
export const NOTE_CHANNELS = {
  CREATE: 'notes:create',
  UPDATE: 'notes:update',
  DELETE: 'notes:delete',
  GET: 'notes:get',
  GET_BY_PATH: 'notes:getByPath',
  GET_CONTENT: 'notes:getContent',
  GET_ALL: 'notes:getAll',
  GET_ALL_TODOS: 'notes:getAllTodos',
  GET_NOTE_TODOS: 'notes:getNoteTodos',
  UPDATE_TASK_STATE: 'notes:updateTaskState',
  TOGGLE_TASK: 'notes:toggleTask',
  FAVORITE: 'notes:favorite',
  PIN: 'notes:pin',
  ARCHIVE: 'notes:archive',
  GET_VERSIONS: 'notes:getVersions',
  GET_VERSION: 'notes:getVersion',
  CREATE_VERSION: 'notes:createVersion',
  RESTORE_VERSION: 'notes:restoreVersion',
  GET_BACKLINKS: 'notes:getBacklinks',
  GET_FORWARD_LINKS: 'notes:getForwardLinks',
  GET_GRAPH_DATA: 'notes:getGraphData',
  MOVE: 'notes:move',
  EXPORT_HTML: 'notes:exportHtml',
  EXPORT_PDF: 'notes:exportPdf',
  EXPORT_MARKDOWN: 'notes:exportMarkdown',
} as const;

// Notebook Operations
export const NOTEBOOK_CHANNELS = {
  CREATE: 'notebooks:create',
  UPDATE: 'notebooks:update',
  DELETE: 'notebooks:delete',
  GET_ALL: 'notebooks:getAll',
  MOVE: 'notebooks:move',
} as const;

// Tag Operations
export const TAG_CHANNELS = {
  CREATE: 'tags:create',
  DELETE: 'tags:delete',
  GET_ALL: 'tags:getAll',
  ADD_TO_NOTE: 'tags:addToNote',
  REMOVE_FROM_NOTE: 'tags:removeFromNote',
} as const;

// Topic Operations (Semantic Classification)
export const TOPIC_CHANNELS = {
  GET_ALL: 'topics:getAll',
  GET_BY_ID: 'topics:getById',
  CREATE: 'topics:create',
  UPDATE: 'topics:update',
  DELETE: 'topics:delete',
  GET_NOTES_BY_TOPIC: 'topics:getNotesByTopic',
  GET_TOPICS_FOR_NOTE: 'topics:getTopicsForNote',
  ASSIGN_TO_NOTE: 'topics:assignToNote',
  REMOVE_FROM_NOTE: 'topics:removeFromNote',
  CLASSIFY_NOTE: 'topics:classifyNote',
  CLASSIFY_ALL: 'topics:classifyAll',
  RECLASSIFY_ALL: 'topics:reclassifyAll',
  SEMANTIC_SEARCH: 'topics:semanticSearch',
  GET_SIMILAR_NOTES: 'topics:getSimilarNotes',
  RECOMPUTE_CENTROIDS: 'topics:recomputeCentroids',
  GET_EMBEDDING_STATUS: 'topics:getEmbeddingStatus',
  INITIALIZE: 'topics:initialize',
  GET_SUGGESTIONS: 'topics:getSuggestions',
  ADOPT_SUGGESTION: 'topics:adoptSuggestion',
} as const;

// Search Operations
export const SEARCH_CHANNELS = {
  FULL_TEXT: 'search:fullText',
  SEMANTIC: 'search:semantic',
  HYBRID: 'search:hybrid',
  BY_TAG: 'search:byTag',
  BY_DATE_RANGE: 'search:byDateRange',
  GET_RELATED: 'search:getRelated',
} as const;

// AI Operations
export const AI_CHANNELS = {
  ASK_NOTES: 'ai:askNotes',
  WARM_TRANSCRIBER: 'ai:warmTranscriber',
  SUMMARIZE_NOTE: 'ai:summarizeNote',
  SUGGEST_LINKS: 'ai:suggestLinks',
} as const;

// Chunk index operations
export const INDEX_CHANNELS = {
  GET_STATS: 'index:getStats',
  INDEX_NOTE: 'index:indexNote',
  REBUILD_ALL: 'index:rebuildAll',
} as const;

// Meeting recording operations
export const MEETING_CHANNELS = {
  RESERVE_SLOT: 'meetings:reserveSlot',
  APPEND_AUDIO: 'meetings:appendAudio',
  FINALIZE: 'meetings:finalize',
  LIST: 'meetings:list',
  GET: 'meetings:get',
  DELETE: 'meetings:delete',
  RESUMMARIZE: 'meetings:resummarize',
  SEND_TO_JOURNAL: 'meetings:sendToJournal',
  // Cross-window: Quick Capture sends this so the main window opens
  // the recording dock and focuses itself.
  REQUEST_RECORDING: 'meetings:requestRecording',
  // Renderer → main: notify the tray of recorder phase changes so it
  // can update its title, icon, and menu items.
  TRAY_SET_STATE: 'meetings:traySetState',
} as const;

// Template operations
export const TEMPLATE_CHANNELS = {
  LIST: 'templates:list',
  CREATE_NOTE_FROM_TEMPLATE: 'templates:createNote',
} as const;

// Daily Review operations
export const DAILY_REVIEW_CHANNELS = {
  GET: 'dailyReview:get',
} as const;

// Status Report operations
export const STATUS_REPORT_CHANNELS = {
  GENERATE: 'statusReport:generate',
} as const;

// Attachment Operations
export const ATTACHMENT_CHANNELS = {
  ADD: 'attachments:add',
  DELETE: 'attachments:delete',
  GET_ALL: 'attachments:getAll',
  UPLOAD_IMAGE: 'attachments:uploadImage',
} as const;

// Database Operations
export const DATABASE_CHANNELS = {
  GET_STATUS: 'db:getStatus',
  RUN_MIGRATIONS: 'db:runMigrations',
  BACKUP: 'db:backup',
  RESTORE: 'db:restore',
  EXPORT: 'db:export',
  IMPORT: 'db:import',
  VACUUM: 'db:vacuum',
  CHECK_INTEGRITY: 'db:checkIntegrity',
  GET_MIGRATION_HISTORY: 'db:getMigrationHistory',
} as const;

// Settings Operations
export const SETTINGS_CHANNELS = {
  GET: 'settings:get',
  SET: 'settings:set',
  GET_ALL: 'settings:getAll',
  GET_APPEARANCE: 'settings:getAppearance',
  SET_THEME: 'settings:setTheme',
  SET_ACCENT_COLOR: 'settings:setAccentColor',
  UPDATE_FONT_SETTINGS: 'settings:updateFontSettings',
  RESET_FONT_SETTINGS: 'settings:resetFontSettings',
  // Editor settings
  GET_EDITOR: 'settings:getEditor',
  UPDATE_EDITOR: 'settings:updateEditor',
  RESET_EDITOR: 'settings:resetEditor',
  // Shortcuts
  GET_SHORTCUTS: 'settings:getShortcuts',
  SET_SHORTCUT: 'settings:setShortcut',
  RESET_SHORTCUT: 'settings:resetShortcut',
  RESET_ALL_SHORTCUTS: 'settings:resetAllShortcuts',
  // AI
  GET_AI: 'settings:getAI',
  UPDATE_AI: 'settings:updateAI',
  RESET_AI: 'settings:resetAI',
  GET_AI_PROVIDER_KEYS: 'settings:getAIProviderKeys',
  SET_AI_PROVIDER_KEY: 'settings:setAIProviderKey',
  DELETE_AI_PROVIDER_KEY: 'settings:deleteAIProviderKey',
} as const;

// System Operations
export const SYSTEM_CHANNELS = {
  GET_FONTS: 'system:getFonts',
  GET_MIC_ACCESS_STATUS: 'system:getMicAccessStatus',
  REQUEST_MIC_ACCESS: 'system:requestMicAccess',
} as const;

// Git Operations
export const GIT_CHANNELS = {
  GET_STATUS: 'git:getStatus',
  INIT: 'git:init',
  COMMIT: 'git:commit',
  PULL: 'git:pull',
  PUSH: 'git:push',
  SYNC: 'git:sync',
  SET_REMOTE: 'git:setRemote',
  GET_COMMITS: 'git:getCommits',
} as const;

// Quick Capture Operations
export const QUICK_CAPTURE_CHANNELS = {
  APPEND_TO_JOURNAL: 'quickCapture:appendToJournal',
  TRANSCRIBE_VOICE: 'quickCapture:transcribeVoice',
} as const;

// Journal Operations
export const JOURNAL_CHANNELS = {
  OPEN_OR_CREATE_FOR_DATE: 'journal:openOrCreateForDate',
  LIST_RANGE: 'journal:listRange',
} as const;

// Quick Note (slot-based) Operations
export const QUICK_NOTE_CHANNELS = {
  CREATE_IN_SLOT: 'quickNote:createInSlot',
} as const;

// Scratch Editor Operations (open arbitrary .md files outside any workspace)
export const SCRATCH_CHANNELS = {
  PICK: 'scratch:pick',
  READ: 'scratch:read',
  WRITE: 'scratch:write',
} as const;

// Performance Monitoring Operations
export const PERFORMANCE_CHANNELS = {
  GET_SNAPSHOT: 'performance:getSnapshot',
  GET_MEMORY: 'performance:getMemory',
  GET_CPU: 'performance:getCPU',
  GET_IPC_STATS: 'performance:getIPCStats',
  GET_DB_STATS: 'performance:getDBStats',
  GET_STARTUP: 'performance:getStartup',
  CLEAR_HISTORY: 'performance:clearHistory',
} as const;

// Events
export const EVENTS = {
  // Workspace events
  WORKSPACE_CREATED: 'workspaces:created',
  WORKSPACE_UPDATED: 'workspaces:updated',
  WORKSPACE_DELETED: 'workspaces:deleted',
  WORKSPACE_SWITCHED: 'workspaces:switched',
  WORKSPACE_SCANNED: 'workspaces:scanned',
  FILE_CHANGED: 'files:changed',
  FILE_CREATED: 'files:created',
  FILE_DELETED: 'files:deleted',
  FILE_SYNCED: 'files:synced',

  // Note events
  NOTE_CREATED: 'notes:created',
  NOTE_UPDATED: 'notes:updated',
  NOTE_DELETED: 'notes:deleted',
  NOTE_VERSION_RESTORED: 'notes:versionRestored',

  // Scratch editor events (main → renderer push)
  SCRATCH_OPEN_PATH: 'scratch:openPath',

  // Meeting recorder cross-window: Quick Capture → main window asks the
  // recording dock to open (and main window comes to the foreground).
  MEETING_OPEN_DOCK_REQUESTED: 'meetings:openDockRequested',
  // Tray menu / global shortcuts ask the renderer to open the dock AND
  // auto-start a recording in one step.
  MEETING_START_REQUESTED: 'meetings:startRequested',
  // Tray menu while recording asks the renderer to stop.
  MEETING_STOP_REQUESTED: 'meetings:stopRequested',

  // Notebook events
  NOTEBOOK_CREATED: 'notebooks:created',
  NOTEBOOK_UPDATED: 'notebooks:updated',
  NOTEBOOK_DELETED: 'notebooks:deleted',

  // Tag events
  TAG_CREATED: 'tags:created',
  TAG_UPDATED: 'tags:updated',
  TAG_DELETED: 'tags:deleted',

  // Attachment events
  ATTACHMENT_ADDED: 'attachments:added',
  ATTACHMENT_DELETED: 'attachments:deleted',

  // Database events
  DB_MIGRATION_PROGRESS: 'db:migrationProgress',
  DB_MIGRATION_COMPLETE: 'db:migrationComplete',
  DB_BACKUP_PROGRESS: 'db:backupProgress',
  DB_BACKUP_COMPLETE: 'db:backupComplete',
  DB_RESTORE_PROGRESS: 'db:restoreProgress',
  DB_RESTORE_COMPLETE: 'db:restoreComplete',
  DB_VACUUM_PROGRESS: 'db:vacuumProgress',
  DB_VACUUM_COMPLETE: 'db:vacuumComplete',

  // Settings events
  SETTINGS_CHANGED: 'settings:changed',

  // Topic events
  TOPIC_CREATED: 'topics:created',
  TOPIC_UPDATED: 'topics:updated',
  TOPIC_DELETED: 'topics:deleted',
  NOTE_CLASSIFIED: 'topics:noteClassified',
  EMBEDDING_PROGRESS: 'topics:embeddingProgress',

  // ML Service status events
  ML_STATUS_CHANGED: 'ml:statusChanged',
  ML_OPERATION_STARTED: 'ml:operationStarted',
  ML_OPERATION_PROGRESS: 'ml:operationProgress',
  ML_OPERATION_COMPLETED: 'ml:operationCompleted',
  ML_OPERATION_ERROR: 'ml:operationError',
  ML_MODEL_DOWNLOAD_PROGRESS: 'ml:modelDownloadProgress',
} as const;

// Get all channels as an array for validation
// We need to collect all channel values to avoid key conflicts
// (multiple objects have keys like CREATE, UPDATE, DELETE, GET_ALL)
export const ALL_CHANNELS = [
  ...Object.values(WORKSPACE_CHANNELS),
  ...Object.values(NOTE_CHANNELS),
  ...Object.values(NOTEBOOK_CHANNELS),
  ...Object.values(TAG_CHANNELS),
  ...Object.values(TOPIC_CHANNELS),
  ...Object.values(SEARCH_CHANNELS),
  ...Object.values(AI_CHANNELS),
  ...Object.values(INDEX_CHANNELS),
  ...Object.values(ATTACHMENT_CHANNELS),
  ...Object.values(DATABASE_CHANNELS),
  ...Object.values(SETTINGS_CHANNELS),
  ...Object.values(SYSTEM_CHANNELS),
  ...Object.values(GIT_CHANNELS),
  ...Object.values(QUICK_CAPTURE_CHANNELS),
  ...Object.values(JOURNAL_CHANNELS),
  ...Object.values(QUICK_NOTE_CHANNELS),
  ...Object.values(SCRATCH_CHANNELS),
  ...Object.values(PERFORMANCE_CHANNELS),
  ...Object.values(MEETING_CHANNELS),
  ...Object.values(TEMPLATE_CHANNELS),
  ...Object.values(DAILY_REVIEW_CHANNELS),
  ...Object.values(STATUS_REPORT_CHANNELS),
];

// Get all events as an array
export const ALL_EVENTS = Object.values(EVENTS);
