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
} as const;

// Note Operations
export const NOTE_CHANNELS = {
  CREATE: 'notes:create',
  UPDATE: 'notes:update',
  DELETE: 'notes:delete',
  GET: 'notes:get',
  GET_CONTENT: 'notes:getContent',
  GET_ALL: 'notes:getAll',
  GET_ALL_TODOS: 'notes:getAllTodos',
  FAVORITE: 'notes:favorite',
  PIN: 'notes:pin',
  ARCHIVE: 'notes:archive',
  GET_VERSIONS: 'notes:getVersions',
  RESTORE_VERSION: 'notes:restoreVersion',
  GET_BACKLINKS: 'notes:getBacklinks',
  MOVE: 'notes:move',
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

// Search Operations
export const SEARCH_CHANNELS = {
  FULL_TEXT: 'search:fullText',
  SEMANTIC: 'search:semantic',
  HYBRID: 'search:hybrid',
  BY_TAG: 'search:byTag',
  BY_DATE_RANGE: 'search:byDateRange',
} as const;

// Attachment Operations
export const ATTACHMENT_CHANNELS = {
  ADD: 'attachments:add',
  DELETE: 'attachments:delete',
  GET_ALL: 'attachments:getAll',
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
} as const;

// System Operations
export const SYSTEM_CHANNELS = {
  GET_FONTS: 'system:getFonts',
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

  // Note events
  NOTE_CREATED: 'notes:created',
  NOTE_UPDATED: 'notes:updated',
  NOTE_DELETED: 'notes:deleted',
  NOTE_VERSION_RESTORED: 'notes:versionRestored',

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
} as const;

// Get all channels as an array for validation
// We need to collect all channel values to avoid key conflicts
// (multiple objects have keys like CREATE, UPDATE, DELETE, GET_ALL)
export const ALL_CHANNELS = [
  ...Object.values(WORKSPACE_CHANNELS),
  ...Object.values(NOTE_CHANNELS),
  ...Object.values(NOTEBOOK_CHANNELS),
  ...Object.values(TAG_CHANNELS),
  ...Object.values(SEARCH_CHANNELS),
  ...Object.values(ATTACHMENT_CHANNELS),
  ...Object.values(DATABASE_CHANNELS),
  ...Object.values(SETTINGS_CHANNELS),
  ...Object.values(SYSTEM_CHANNELS),
];

// Get all events as an array
export const ALL_EVENTS = Object.values(EVENTS);
