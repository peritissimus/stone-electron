import {
  type ISelectFolderUseCase,
  type SelectFolderRequest,
  type SelectFolderResponse,
} from '../../../domain';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';

export class SelectFolderUseCase implements ISelectFolderUseCase {
  constructor(private readonly systemService: ISystemBridge) {}

  async execute(request?: SelectFolderRequest): Promise<SelectFolderResponse> {
    const folderPath = await this.systemService.selectFolder({
      title: request?.title || 'Select Workspace Folder',
      defaultPath: request?.defaultPath,
      buttonLabel: 'Select Folder',
    });

    if (!folderPath) {
      return { canceled: true };
    }

    return { canceled: false, folderPath };
  }
}
