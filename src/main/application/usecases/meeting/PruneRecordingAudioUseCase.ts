/**
 * PruneRecordingAudioUseCase — the audio retention sweep.
 *
 * Deletes the audio files of recordings older than the configured window
 * (`meetings.audioRetentionDays`), keeping their transcript + summary. Run
 * at startup as best-effort maintenance.
 *
 * Retention semantics (see MeetingsConfig.audioRetentionDays):
 *   0  → keep until the meeting is deleted — sweep does nothing.
 *   -1 → delete right after transcribing — handled at finalize, not here.
 *   N  → delete audio N days after the recording was created — this sweep.
 *
 * DESTRUCTIVE: only the audio is removed. Each deletion clears the entity's
 * audioPath so the UI stops offering replay / re-transcribe.
 */

import type {
  IAppConfigRepository,
  IFileStorage,
  IMeetingRecordingRepository,
  IPathService,
  IWorkspaceRepository,
} from '../../../domain';
import type {
  IPruneRecordingAudioUseCase,
  PruneRecordingAudioResponse,
} from '../../../domain/ports/in/IMeetingUseCases';
import { deleteRecordingAudioFiles } from './meetingAudioCleanup';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PruneRecordingAudioUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  pathService: IPathService;
  appConfigRepository: IAppConfigRepository;
}

export class PruneRecordingAudioUseCase implements IPruneRecordingAudioUseCase {
  constructor(private readonly deps: PruneRecordingAudioUseCaseDeps) {}

  async execute(): Promise<PruneRecordingAudioResponse> {
    const config = await this.deps.appConfigRepository.get();
    const days = config.meetings.audioRetentionDays;

    // Only a positive day count triggers the age-based sweep. 0 keeps audio
    // forever; -1 ("delete after transcribing") is enforced at finalize.
    if (!Number.isFinite(days) || !Number.isInteger(days) || days <= 0) {
      return { deletedCount: 0 };
    }

    const cutoff = new Date(Date.now() - days * MS_PER_DAY);
    const stale = await this.deps.meetingRepository.listWithAudioOlderThan(cutoff);
    if (stale.length === 0) return { deletedCount: 0 };

    // Cache workspace lookups — single-workspace today, but correct for N.
    const folderPaths = new Map<string, string | null>();
    let deletedCount = 0;

    for (const recording of stale) {
      if (!recording.audioPath) continue;

      let folderPath = folderPaths.get(recording.workspaceId);
      if (folderPath === undefined) {
        const workspace = await this.deps.workspaceRepository.findById(recording.workspaceId);
        folderPath = workspace ? workspace.folderPath : null;
        folderPaths.set(recording.workspaceId, folderPath);
      }
      if (!folderPath) continue;

      await deleteRecordingAudioFiles(this.deps, folderPath, recording.audioPath);
      recording.clearAudio();
      await this.deps.meetingRepository.save(recording);
      deletedCount += 1;
    }

    return { deletedCount };
  }
}
