import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IGetSystemFontsUseCase } from '../../../domain/ports/in/ISystemUseCases';
import { logger } from '../../../shared/utils';

export class GetSystemFontsUseCase implements IGetSystemFontsUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ fonts: string[] }> {
    const fonts = await this.systemBridge.getFonts();
    logger.debug(`[SystemUseCases] Retrieved ${fonts.length} system fonts`);
    return { fonts };
  }
}
