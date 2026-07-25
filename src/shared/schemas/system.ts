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

import { z } from './schema';

export const SystemGetFontsResponseSchema = z.object({
  fonts: z.array(z.string()),
});
export const MicAccessStatusSchema = z.literalEnum([
  'granted',
  'denied',
  'not-determined',
  'restricted',
  'unknown',
]);
export const SystemAudioAccessSchema = z.literalEnum(['granted', 'denied', 'unsupported']);
export const MicAccessStatusResponseSchema = z.object({ status: MicAccessStatusSchema });
export const RequestMicAccessResponseSchema = z.object({
  granted: z.boolean(),
  status: MicAccessStatusSchema,
});
export const SystemAudioAccessResponseSchema = z.object({ status: SystemAudioAccessSchema });

export type SystemGetFontsResponse = z.infer<typeof SystemGetFontsResponseSchema>;
