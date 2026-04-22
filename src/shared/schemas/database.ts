/**
 * Database IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/DatabaseIPC.ts`
 *   - renderer `api/settingsAPI.ts` (databaseAPI)
 *
 * Coverage: only the three channels the backend actually registers
 * (GET_STATUS / VACUUM / CHECK_INTEGRITY). The channel constants file
 * lists more (RUN_MIGRATIONS / BACKUP / RESTORE / EXPORT / IMPORT /
 * GET_MIGRATION_HISTORY) but none of those have handlers — they are
 * aspirational and should not be called until implemented.
 */

import { z } from 'zod';

export const DatabaseStatusResponseSchema = z.object({
  path: z.string(),
  databaseSize: z.number(),
  isOpen: z.boolean(),
  noteCount: z.number(),
  notebookCount: z.number(),
  tagCount: z.number(),
});

export type DatabaseStatusResponse = z.infer<typeof DatabaseStatusResponseSchema>;

export const VacuumDatabaseResponseSchema = z.object({
  size_before: z.number(),
  size_after: z.number(),
  freed_bytes: z.number(),
});

export type VacuumDatabaseResponse = z.infer<typeof VacuumDatabaseResponseSchema>;

export const CheckDatabaseIntegrityResponseSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
});

export type CheckDatabaseIntegrityResponse = z.infer<typeof CheckDatabaseIntegrityResponseSchema>;
