/**
 * Workspace IPC wire schemas.
 *
 * Single source of truth for workspace:* channels.
 * Consumed by:
 *   - main `adapters/in/ipc/WorkspaceIPC.ts` (request .parse() + response types)
 *   - renderer `api/workspaceAPI.ts` (response validation)
 */

import { z } from 'zod';

const IsoOrDate = z.union([z.string(), z.date(), z.number()]);

// ============================================================================
// Response shapes
// ============================================================================

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  folderPath: z.string(),
  isActive: z.boolean(),
  createdAt: IsoOrDate,
  lastAccessedAt: IsoOrDate,
});

export type WorkspaceResponse = z.infer<typeof WorkspaceSchema>;

export const ListWorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
});

export type ListWorkspacesResponse = z.infer<typeof ListWorkspacesResponseSchema>;

// The active workspace can be genuinely absent — use .nullish() (null | undefined),
// not .optional(), since the backend returns `null` when no workspace is active.
export const GetActiveWorkspaceResponseSchema = z.object({
  workspace: WorkspaceSchema.nullish(),
});

export type GetActiveWorkspaceResponse = z.infer<typeof GetActiveWorkspaceResponseSchema>;

export const ValidatePathResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string().optional(),
});

export type ValidatePathResponse = z.infer<typeof ValidatePathResponseSchema>;

export const FolderPathResponseSchema = z.object({
  folderPath: z.string(),
});

export type FolderPathResponse = z.infer<typeof FolderPathResponseSchema>;

export const SelectFolderResponseSchema = z.object({
  canceled: z.boolean().optional(),
  folderPath: z.string().optional(),
});

export type SelectFolderResponse = z.infer<typeof SelectFolderResponseSchema>;

export const DefaultWorkspacePathResponseSchema = z.object({
  path: z.string(),
});

export type DefaultWorkspacePathResponse = z.infer<typeof DefaultWorkspacePathResponseSchema>;

// Scan returns a full file/folder tree; matches the use case shape.
// `files` and `total` are extras the renderer currently ignores but are
// still asserted here so the contract captures reality.
const ScanFolderNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    relativePath: z.string(),
    type: z.enum(['file', 'folder']),
    children: z.array(ScanFolderNodeSchema).optional(),
  }),
);

export const ScanWorkspaceResponseSchema = z.object({
  files: z
    .array(
      z.object({
        relativePath: z.string(),
        path: z.string(),
      }),
    )
    .optional(),
  structure: z.array(ScanFolderNodeSchema),
  total: z.number().optional(),
  counts: z.record(z.number()).optional(),
});

export type ScanWorkspaceResponse = z.infer<typeof ScanWorkspaceResponseSchema>;

export const SyncWorkspaceResponseSchema = z.object({
  workspaceId: z.string(),
  notebooks: z.object({
    created: z.number(),
    updated: z.number(),
    errors: z.array(z.string()),
  }),
  notes: z.object({
    created: z.number(),
    updated: z.number(),
    deleted: z.number(),
    embedded: z.number(),
    errors: z.array(z.string()),
  }),
});

export type SyncWorkspaceResponse = z.infer<typeof SyncWorkspaceResponseSchema>;

// ============================================================================
// Request payloads
// ============================================================================

export const CreateWorkspaceRequestSchema = z
  .object({
    name: z.string(),
    // Renderer historically sends either `path` or `folderPath`; tolerate
    // both, require one.
    path: z.string().optional(),
    folderPath: z.string().optional(),
  })
  .refine((v) => typeof v.path === 'string' || typeof v.folderPath === 'string', {
    message: 'Either "path" or "folderPath" is required',
  });

export const UpdateWorkspaceRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
  })
  .strict();

export const WorkspaceIdRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict();

export const ValidatePathRequestSchema = z
  .object({
    // `path` is the current renderer field; `folderPath` kept for legacy
    // compatibility. Require one.
    path: z.string().optional(),
    folderPath: z.string().optional(),
  })
  .refine((v) => typeof v.path === 'string' || typeof v.folderPath === 'string', {
    message: 'Either "path" or "folderPath" is required',
  });

export const CreateFolderRequestSchema = z
  .object({
    name: z.string(),
    parentPath: z.string().optional(),
  })
  .strict();

export const RenameFolderRequestSchema = z
  .object({
    path: z.string(),
    name: z.string(),
  })
  .strict();

export const DeleteFolderRequestSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export const MoveFolderRequestSchema = z
  .object({
    sourcePath: z.string(),
    destinationPath: z.string().nullable(),
  })
  .strict();

export const ScanWorkspaceRequestSchema = z
  .object({
    workspaceId: z.string(),
  })
  .strict();

export const SyncWorkspaceRequestSchema = z
  .object({
    workspaceId: z.string().optional(),
  })
  .passthrough();

export const SelectFolderRequestSchema = z
  .object({
    title: z.string().optional(),
    defaultPath: z.string().optional(),
  })
  .passthrough();
