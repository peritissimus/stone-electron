import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IOpenExternalUseCase } from '../../../domain/ports/in/ISystemUseCases';

export class OpenExternalUseCase implements IOpenExternalUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(request: { url: string }): Promise<void> {
    await this.systemBridge.openExternal(request.url);
  }
}
