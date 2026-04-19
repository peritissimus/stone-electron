import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IShowFolderPickerUseCase } from '../../../domain/ports/in/ISystemUseCases';

export class ShowFolderPickerUseCase implements IShowFolderPickerUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(
    request?: { title?: string; defaultPath?: string },
  ): Promise<{ folderPath: string | null }> {
    const folderPath = await this.systemBridge.selectFolder(request);
    return { folderPath };
  }
}
