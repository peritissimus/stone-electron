import type { IVersionRepository } from '../../../domain/ports/out/IVersionRepository';
import type {
  IGetVersionUseCase,
  VersionSnapshot,
} from '../../../domain/ports/in/IVersionUseCases';
import { VersionDiffer } from '../../../domain/services/VersionDiffer';

/**
 * Get a specific version
 */
export class GetVersionUseCase implements IGetVersionUseCase {
  constructor(private readonly versionRepository: IVersionRepository) {}

  async execute(versionId: string): Promise<VersionSnapshot | null> {
    const version = await this.versionRepository.findById(versionId);
    if (!version) return null;

    return VersionDiffer.toSnapshot(version);
  }
}
