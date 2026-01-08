/**
 * System Use Cases - System-level operations
 */

import type { ISystemService } from '../../../domain/ports/out/ISystemService';
import type { ISystemUseCases } from '../../../domain/ports/in/ISystemUseCases';
import { logger } from '../../../shared/utils';

export interface SystemUseCasesDeps {
  systemService: ISystemService;
}

class SystemUseCasesImpl implements ISystemUseCases {
  constructor(private deps: SystemUseCasesDeps) {}

  async getFonts(): Promise<string[]> {
    const fonts = await this.deps.systemService.getFonts();
    logger.debug(`[SystemUseCases] Retrieved ${fonts.length} system fonts`);
    return fonts;
  }

  async selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null> {
    return this.deps.systemService.selectFolder(options);
  }

  async validatePath(path: string): Promise<boolean> {
    return this.deps.systemService.validatePath(path);
  }

  openInFolder(path: string): void {
    this.deps.systemService.showInFolder(path);
  }

  async openExternal(url: string): Promise<void> {
    await this.deps.systemService.openExternal(url);
  }
}

export function createSystemUseCases(deps: SystemUseCasesDeps): ISystemUseCases {
  return new SystemUseCasesImpl(deps);
}
