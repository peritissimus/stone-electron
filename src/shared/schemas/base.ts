/**
 * Base IPC wire-boundary schemas.
 *
 * These describe the serialized envelope between the main and renderer
 * processes. They live in `shared/` because both processes consume them;
 * they must stay side-effect-free and contain no business logic.
 */

import { z } from 'zod';

export const IpcErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type IpcErrorPayload = z.infer<typeof IpcErrorPayloadSchema>;

/**
 * The envelope that wraps every IPC response. Generated as a factory so
 * callers can bind their own payload schema: `IpcResponseSchema(MySchema)`.
 */
export const IpcResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: IpcErrorPayloadSchema.optional(),
  });
