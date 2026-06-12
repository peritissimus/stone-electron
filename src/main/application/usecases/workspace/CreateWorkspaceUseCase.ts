import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type ICreateWorkspaceUseCase,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type IIdGenerator,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateWorkspaceUseCase implements ICreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly fileStorage: IFileStorage,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly pathService: IPathService,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
    // Ensure the target folder exists and is scaffolded. The native picker
    // guarantees the root for user-selected folders, but onboarding may pass
    // a suggested default (e.g. ~/Documents/Stone) that doesn't exist yet.
    // Recursive mkdir is idempotent, so this is a no-op when already there.
    await this.fileStorage.createDirectory(request.folderPath);
    await this.scaffoldStandardFolders(request.folderPath);

    // Idempotent on folder: folder_path is UNIQUE in the DB, and a folder
    // already backing a workspace IS that workspace (single-workspace mode).
    // Re-running onboarding (or picking the same folder twice) returns the
    // existing row instead of surfacing a raw constraint violation. The
    // scaffold above still runs, so a previously-bare workspace gets its
    // standard folders backfilled.
    const existing = (await this.workspaceRepository.findAll()).find(
      (w) => w.folderPath === request.folderPath,
    );
    if (existing) {
      return { workspace: existing };
    }

    const workspace = WorkspaceEntity.create({
      id: this.idGenerator.generate(),
      name: request.name,
      folderPath: request.folderPath,
      isActive: false,
    });

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.WORKSPACE_CREATED,
      timestamp: new Date(),
      payload: { workspace: workspace.toPersistence() },
    });

    return { workspace: workspace.toPersistence() };
  }

  /**
   * Create the folders every Stone flow writes into, derived from the
   * configured note location policy (Journal, Personal, Work by default).
   * Without these a fresh workspace renders an empty file tree and the
   * journal/quick-note flows have nowhere obvious to land; the next
   * workspace sync imports them as notebooks.
   */
  private async scaffoldStandardFolders(workspaceRoot: string): Promise<void> {
    const config = await this.appConfigRepository.get();
    const policy = config.notes.locationPolicy;
    const folders = new Set(
      [
        policy.journalFolder,
        policy.defaultNoteFolder,
        ...Object.values(policy.quickNoteSlotFolders),
      ].filter(Boolean),
    );
    for (const folder of folders) {
      await this.fileStorage.createDirectory(this.pathService.join(workspaceRoot, folder));
    }
  }
}
