/**
 * System Use Cases - System-level operations
 */

import type { ISystemBridge } from '../../domain/ports/out/ISystemBridge';
import type { ISystemUseCases } from '../../domain/ports/in/ISystemUseCases';
import { logger } from '../../shared/utils';

export interface SystemUseCasesDeps {
  systemBridge: ISystemBridge;
}

class SystemUseCasesImpl implements ISystemUseCases {
  constructor(private deps: SystemUseCasesDeps) {}

  async getFonts(): Promise<string[]> {
    const fonts = await this.deps.systemBridge.getFonts();
    logger.debug(`[SystemUseCases] Retrieved ${fonts.length} system fonts`);
    return fonts;
  }

  async selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null> {
    return this.deps.systemBridge.selectFolder(options);
  }

  async validatePath(path: string): Promise<boolean> {
    return this.deps.systemBridge.validatePath(path);
  }

  openInFolder(path: string): void {
    this.deps.systemBridge.showInFolder(path);
  }

  async openExternal(url: string): Promise<void> {
    await this.deps.systemBridge.openExternal(url);
  }
}

export function createSystemUseCases(deps: SystemUseCasesDeps): ISystemUseCases {
  return new SystemUseCasesImpl(deps);
}
