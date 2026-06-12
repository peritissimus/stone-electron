import type {
  ITranscribeVoiceCaptureUseCase,
  TranscribeVoiceCaptureRequest,
  TranscribeVoiceCaptureResponse,
} from '../../../domain/ports/in/IQuickCaptureUseCases';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { ITranscriber } from '../../../domain/ports/out/ITranscriber';
import { WorkspaceNotFoundError } from '../../../domain/errors';

/** Voice captures share the meeting recorder's scratch dir under the workspace. */
const CAPTURES_DIR = '.stone/recordings';

/**
 * Transcribe a short voice capture: write the WAV to a scratch file under the
 * workspace, run the local Whisper transcriber, and clean the file up. Pure
 * speech→text — appending the transcript to the journal stays a separate
 * step so the renderer can let the user review/edit before saving.
 */
export class TranscribeVoiceCaptureUseCase implements ITranscribeVoiceCaptureUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
    private readonly idGenerator: IIdGenerator,
    private readonly transcriber: ITranscriber,
  ) {}

  async execute(request: TranscribeVoiceCaptureRequest): Promise<TranscribeVoiceCaptureResponse> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();
    if (!workspace) {
      throw new WorkspaceNotFoundError(request.workspaceId ?? 'active');
    }

    const capturesDir = this.pathService.join(workspace.folderPath, CAPTURES_DIR);
    const audioPath = this.pathService.join(
      capturesDir,
      `capture-${this.idGenerator.generate()}.wav`,
    );

    await this.fileStorage.createDirectory(capturesDir);
    await this.fileStorage.writeBytes(audioPath, request.wav);

    try {
      const result = await this.transcriber.transcribe({ audioPath });
      return { text: result.text.trim(), durationMs: result.durationMs };
    } finally {
      // Scratch audio is never kept — the transcript is the artifact.
      try {
        await this.fileStorage.delete(audioPath);
      } catch {
        // Best-effort cleanup; a stray scratch file is harmless.
      }
    }
  }
}
