import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { IReadScratchFileUseCase } from '../../../domain/ports/in/IScratchUseCases';

// Prevent the renderer from pulling a huge file into an in-memory TipTap
// document. Well above any sensible note size but caps obvious abuse.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown']);

export class ReadScratchFileUseCase implements IReadScratchFileUseCase {
  constructor(
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: { path: string }): Promise<{ path: string; name: string; content: string }> {
    const abs = this.pathService.isAbsolute(request.path) ? request.path : this.pathService.resolve(request.path);
    const ext = this.pathService.extname(abs).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type for scratch editor: ${ext || '(none)'}`);
    }

    const info = await this.fileStorage.getFileInfo(abs);
    if (!info || info.isDirectory) {
      throw new Error(`File not found: ${abs}`);
    }
    if (info.size > MAX_FILE_BYTES) {
      throw new Error(
        `File too large for scratch editor: ${info.size} bytes (cap ${MAX_FILE_BYTES})`,
      );
    }

    const content = (await this.fileStorage.read(abs)) ?? '';
    return { path: abs, name: this.pathService.basename(abs), content };
  }
}
