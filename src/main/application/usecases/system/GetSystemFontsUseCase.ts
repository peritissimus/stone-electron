import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IGetSystemFontsUseCase } from '../../../domain/ports/in/ISystemUseCases';

export class GetSystemFontsUseCase implements IGetSystemFontsUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ fonts: string[] }> {
    const fonts = await this.systemBridge.getFonts();
    return { fonts };
  }
}
