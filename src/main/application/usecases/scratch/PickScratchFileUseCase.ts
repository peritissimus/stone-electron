import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IPickScratchFileUseCase } from '../../../domain/ports/in/IScratchUseCases';

const MARKDOWN_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown'] }];

export class PickScratchFileUseCase implements IPickScratchFileUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ path: string | null }> {
    const selection = await this.systemBridge.selectFile({
      title: 'Open Markdown File',
      filters: MARKDOWN_FILTERS,
    });
    const picked = Array.isArray(selection) ? selection[0] ?? null : selection ?? null;
    return { path: picked };
  }
}
