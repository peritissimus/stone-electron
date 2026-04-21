import {
  type ISelectFolderUseCase,
  type SelectFolderRequest,
  type SelectFolderResponse,
} from '../../../domain';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';

export class SelectFolderUseCase implements ISelectFolderUseCase {
  constructor(
    private readonly systemBridge: ISystemBridge,
    private readonly appConfigRepository: IAppConfigRepository,
  ) {}

  async execute(request?: SelectFolderRequest): Promise<SelectFolderResponse> {
    const config = await this.appConfigRepository.get();
    const folderPath = await this.systemBridge.selectFolder({
      title: request?.title || 'Select Workspace Folder',
      defaultPath: request?.defaultPath ?? config.workspace.defaultWorkspacePath,
      buttonLabel: 'Select Folder',
    });

    if (!folderPath) {
      return { canceled: true };
    }

    return { canceled: false, folderPath };
  }
}
