/**
 * Shared audio-deletion helper for the meeting retention paths.
 *
 * A recording captures up to two sibling WAV files — the mic track
 * (`recording.audioPath`) and the system-audio track (`*.system.wav`).
 * Deleting a recording's audio must remove BOTH; the system track would
 * otherwise be orphaned on disk. Best-effort: missing files are ignored.
 */

import type { IFileStorage, IPathService } from '../../../domain';
import { systemTrackPath } from '../../../domain/ports/in/IMeetingUseCases';

export interface AudioCleanupDeps {
  fileStorage: IFileStorage;
  pathService: IPathService;
}

/**
 * Delete the mic + system WAV files for a recording. `workspaceFolderPath`
 * is the absolute workspace root; `relativeAudioPath` is the mic track's
 * workspace-relative path. Never throws.
 */
export async function deleteRecordingAudioFiles(
  deps: AudioCleanupDeps,
  workspaceFolderPath: string,
  relativeAudioPath: string,
): Promise<void> {
  const micAbsolute = deps.pathService.join(workspaceFolderPath, relativeAudioPath);
  const systemAbsolute = deps.pathService.join(
    workspaceFolderPath,
    systemTrackPath(relativeAudioPath),
  );

  for (const path of [micAbsolute, systemAbsolute]) {
    try {
      await deps.fileStorage.delete(path);
    } catch {
      // best-effort — a missing sibling track is not an error.
    }
  }
}
