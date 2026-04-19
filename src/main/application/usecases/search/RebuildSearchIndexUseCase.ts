import type { ISearchEngine } from '../../../domain/ports/out/ISearchEngine';
import type { IRebuildSearchIndexUseCase } from '../../../domain/ports/in/ISearchUseCases';

export class RebuildSearchIndexUseCase implements IRebuildSearchIndexUseCase {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(): Promise<void> {
    await this.searchEngine.rebuildIndex();
  }
}
