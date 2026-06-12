/**
 * RecordingSettings — Settings → Recording. Everything the meeting
 * recorder and voice capture need, in one place:
 *
 *   • Device permissions (microphone + system audio) with live grant
 *     detection — the same rows onboarding shows, so users who skipped
 *     setup (or hit a denial) have a permanent home to fix it.
 *   • The local speech-to-text model: verify/download Whisper with the
 *     same live progress bar as onboarding.
 *   • A plain-language explanation of what gets captured and where the
 *     audio lives.
 */

import { useState } from 'react';
import { Check, CircleNotch, DownloadSimple, Warning } from '@phosphor-icons/react';
import { ContainerStack } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { Progress } from '@renderer/components/base/ui/progress';
import { Caption } from '@renderer/components/base/ui/text';
import { DevicePermissions } from '@renderer/components/composites/DevicePermissions';
import { useOnboarding, useModelDownloadProgress } from '@renderer/hooks/useOnboarding';
import { SettingsSection } from './SettingsSection';

type ModelState = 'idle' | 'running' | 'ready' | 'failed';

export function RecordingSettings() {
  const { warmUpWhisper } = useOnboarding();
  const progress = useModelDownloadProgress();
  const [modelState, setModelState] = useState<ModelState>('idle');

  const handleVerifyModel = async () => {
    setModelState('running');
    const ok = await warmUpWhisper();
    setModelState(ok ? 'ready' : 'failed');
  };

  return (
    <ContainerStack gap="xl">
      <SettingsSection
        title="Permissions"
        description="For meeting recordings and voice notes."
      >
        <DevicePermissions />
      </SettingsSection>

      <SettingsSection
        title="Speech-to-text model"
        description="Runs on this device. ~80 MB, downloaded once."
      >
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Whisper base</div>
              <Caption className="text-muted-foreground">Transcribes your recordings.</Caption>
            </div>
            {modelState === 'ready' && (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check size={11} weight="bold" />
              </span>
            )}
            {modelState === 'failed' && (
              <span
                className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive"
                title="Model download failed — it will retry on first use"
              >
                <Warning size={11} weight="fill" />
              </span>
            )}
            {modelState !== 'running' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleVerifyModel()}
                className="shrink-0 transition-transform active:scale-[0.96]"
              >
                <DownloadSimple size={12} weight="bold" />
                {modelState === 'ready' ? 'Verify again' : 'Download / verify'}
              </Button>
            )}
            {modelState === 'running' && (
              <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                {progress.whisper ? `${progress.whisper.percent}%` : ''}
                <CircleNotch size={14} className="animate-spin text-primary" />
              </span>
            )}
          </div>
          {modelState === 'running' && (
            <div className="mt-2.5">
              <Progress value={progress.whisper?.percent ?? 0} className="h-1.5" />
              {progress.whisper && progress.whisper.totalBytes > 0 && (
                <Caption className="mt-1 block tabular-nums text-muted-foreground">
                  {(progress.whisper.loadedBytes / 1048576).toFixed(1)} /{' '}
                  {(progress.whisper.totalBytes / 1048576).toFixed(1)} MB
                </Caption>
              )}
            </div>
          )}
          {modelState === 'ready' && (
            <Caption className="mt-2 block text-muted-foreground">Ready.</Caption>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Privacy"
        description="Audio never leaves this device. It's deleted after transcription."
      >
        <></>
      </SettingsSection>
    </ContainerStack>
  );
}
