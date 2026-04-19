import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../../domain/ports/out/IVersionRepository';
import type {
  IGetVersionsUseCase,
  VersionSnapshot,
} from '../../../domain/ports/in/IVersionUseCases';
import { VersionDiffer } from '../../../domain/services/VersionDiffer';

/**
 * Get version history for a note
 */
export class GetVersionsUseCase implements IGetVersionsUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly versionRepository: IVersionRepository,
  ) {}

  async execute(noteId: string): Promise<VersionSnapshot[]> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const versions = await this.versionRepository.findByNoteId(noteId);

    return versions.map((v) => VersionDiffer.toSnapshot(v));
  }
}
