/**
 * Workspace Repository Port (Outbound)
 */

import type { WorkspaceEntity, WorkspaceProps } from '../../entities';

export interface IWorkspaceRepository {
  findById(id: string): Promise<WorkspaceProps | null>;
  findByFolderPath(folderPath: string): Promise<WorkspaceProps | null>;
  findAll(): Promise<WorkspaceProps[]>;
  findActive(): Promise<WorkspaceProps | null>;
  save(workspace: WorkspaceEntity): Promise<void>;
  delete(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
