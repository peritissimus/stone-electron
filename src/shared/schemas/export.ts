/**
 * Export IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/ExportIPC.ts`
 *   - renderer `api/noteAPI.ts` (exportHtml / exportPdf / exportMarkdown)
 */

import { z } from 'zod';

// ExportOptions is a flexible bag the backend accepts; we don't constrain
// it tightly at the wire to avoid drifting from the use case's own type.
// The specific fields the renderer currently sends are renderedHtml+title.
const ExportOptionsSchema = z.record(z.unknown()).optional();

export const ExportHtmlRequestSchema = z
  .object({
    id: z.string(),
    renderedHtml: z.string().optional(),
    title: z.string().optional(),
    options: ExportOptionsSchema,
  })
  .strict();

export const ExportPdfRequestSchema = z
  .object({
    id: z.string(),
    renderedHtml: z.string().optional(),
    title: z.string().optional(),
    options: ExportOptionsSchema,
  })
  .strict();

export const ExportMarkdownRequestSchema = z
  .object({
    id: z.string(),
    options: ExportOptionsSchema,
  })
  .strict();

export const ExportHtmlResponseSchema = z.object({
  html: z.string(),
  path: z.string(),
});

export const ExportPdfResponseSchema = z.object({
  path: z.string(),
});

export const ExportMarkdownResponseSchema = z.object({
  markdown: z.string(),
  path: z.string(),
});

export type ExportHtmlResponse = z.infer<typeof ExportHtmlResponseSchema>;
export type ExportPdfResponse = z.infer<typeof ExportPdfResponseSchema>;
export type ExportMarkdownResponse = z.infer<typeof ExportMarkdownResponseSchema>;
