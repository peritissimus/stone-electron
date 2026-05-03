import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { IWriteScratchFileUseCase } from '../../../domain/ports/in/IScratchUseCases';

const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown']);

export class WriteScratchFileUseCase implements IWriteScratchFileUseCase {
  constructor(
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: { path: string; content: string }): Promise<{ path: string }> {
    const abs = this.pathService.isAbsolute(request.path) ? request.path : this.pathService.resolve(request.path);
    const ext = this.pathService.extname(abs).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type for scratch editor: ${ext || '(none)'}`);
    }

    // Scratch writes only over an existing file — the file was opened via
    // the system picker, so the renderer can't hand us an arbitrary path
    // and have us create it. Creation happens only through the normal
    // note/workspace flow, never through scratch.
    const exists = await this.fileStorage.exists(abs);
    if (!exists) {
      throw new Error(`Refusing to create new file from scratch editor: ${abs}`);
    }

    await this.fileStorage.write(abs, request.content);
    return { path: abs };
  }
}
