/**
 * System IPC wire schemas.
 *
 * Describes the request / response payloads for system:* channels.
 * Consumed by:
 *   - main `adapters/in/ipc/SystemIPC.ts` (request parsing + response return type)
 *   - renderer `api/settingsAPI.ts` (response validation)
 *
 * The schema is the single source of truth for the wire shape; derive
 * TypeScript types via `z.infer<typeof …>` rather than declaring them
 * separately.
 */

import { z } from 'zod';

export const SystemGetFontsResponseSchema = z.object({
  fonts: z.array(z.string()),
});

export type SystemGetFontsResponse = z.infer<typeof SystemGetFontsResponseSchema>;
