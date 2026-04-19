import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IOpenInFolderUseCase } from '../../../domain/ports/in/ISystemUseCases';

export class OpenInFolderUseCase implements IOpenInFolderUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(request: { path: string }): Promise<void> {
    this.systemBridge.showInFolder(request.path);
  }
}
