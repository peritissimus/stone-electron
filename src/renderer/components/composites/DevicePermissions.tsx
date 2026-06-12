/**
 * DevicePermissions — the microphone + system-audio permission rows with
 * live grant detection. Shared by the onboarding Permissions step and
 * Settings → Recording, so both surfaces stay in lockstep.
 *
 * Live re-check: every status check spawns a fresh helper process, which
 * reads CURRENT TCC state — so while the user flips a toggle in System
 * Settings, the rows turn green on their own (poll + window refocus).
 */

import { useEffect, useState } from 'react';
import { Check, CircleNotch, Microphone, SpeakerHigh, Warning } from '@phosphor-icons/react';
import { Button } from '@renderer/components/base/ui/button';
import { Caption } from '@renderer/components/base/ui/text';
import { useMicPermission, useSystemAudioPermission } from '@renderer/hooks/useOnboarding';

type PermissionRowState = 'granted' | 'ask' | 'denied' | 'hidden';

function PermissionRow({
  icon,
  title,
  description,
  state,
  requesting,
  deniedHint,
  onAllow,
  onOpenSettings,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: PermissionRowState;
  requesting: boolean;
  deniedHint: string;
  onAllow: () => void;
  onOpenSettings: () => void;
}) {
  if (state === 'hidden') return null;

  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <Caption className="text-muted-foreground">{description}</Caption>
        </div>
        {state === 'granted' && (
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check size={11} weight="bold" />
          </span>
        )}
        {state === 'ask' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAllow}
            disabled={requesting}
            className="shrink-0 transition-transform active:scale-[0.96]"
          >
            {requesting ? <CircleNotch size={12} className="animate-spin" /> : 'Allow'}
          </Button>
        )}
        {state === 'denied' && (
          <span
            className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive"
            title={`${title} access is denied`}
          >
            <Warning size={11} weight="fill" />
          </span>
        )}
      </div>
      {state === 'denied' && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <Caption className="text-muted-foreground">{deniedHint}</Caption>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="shrink-0 transition-transform active:scale-[0.96]"
          >
            Open Settings
          </Button>
        </div>
      )}
    </div>
  );
}

export function DevicePermissions() {
  const mic = useMicPermission();
  const systemAudio = useSystemAudioPermission();
  // macOS only shows the Screen Recording prompt on the app's FIRST-ever
  // ask; later asks return instantly with no UI. Once an Allow click comes
  // back non-granted, stop pretending — flip to the Open Settings state.
  const [systemAudioAsked, setSystemAudioAsked] = useState(false);

  useEffect(() => {
    const refreshAll = () => {
      if (mic.status !== 'granted') void mic.refresh();
      if (systemAudio.status !== 'granted' && systemAudio.status !== 'unsupported') {
        void systemAudio.refresh();
      }
    };
    const everythingSettled =
      (mic.status === 'granted' || mic.status === 'unknown') &&
      (systemAudio.status === 'granted' || systemAudio.status === 'unsupported');
    if (everythingSettled) return;

    const interval = window.setInterval(refreshAll, 2500);
    window.addEventListener('focus', refreshAll);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshAll);
    };
    // refresh callbacks are useCallback-stable; statuses are the real inputs.
  }, [mic.status, systemAudio.status]);

  const micState: PermissionRowState =
    mic.status === 'unknown' || mic.status === null
      ? 'hidden'
      : mic.status === 'granted'
        ? 'granted'
        : mic.status === 'not-determined'
          ? 'ask'
          : 'denied';

  const systemAudioState: PermissionRowState =
    systemAudio.status === 'unsupported' || systemAudio.status === null
      ? 'hidden'
      : systemAudio.status === 'granted'
        ? 'granted'
        : systemAudioAsked
          ? 'denied'
          : 'ask';

  const nothingToShow = micState === 'hidden' && systemAudioState === 'hidden';

  return (
    <div className="space-y-3">
      <PermissionRow
        icon={<Microphone size={14} />}
        title="Microphone"
        description="Your voice in meeting recordings and voice notes — transcribed locally."
        state={micState}
        requesting={mic.requesting}
        deniedHint="Denied — enable Stone under System Settings → Privacy & Security → Microphone."
        onAllow={() => void mic.request()}
        onOpenSettings={mic.openSettings}
      />
      <PermissionRow
        icon={<SpeakerHigh size={14} />}
        title="System audio"
        description="Remote voices in meetings, via Screen & System Audio Recording."
        state={systemAudioState}
        requesting={systemAudio.requesting}
        deniedHint="Enable this app under Screen & System Audio Recording — this row turns green by itself. If a recording still says mic-only afterwards, restart the app."
        onAllow={() => {
          void systemAudio.request().then((granted) => {
            if (!granted) setSystemAudioAsked(true);
          });
        }}
        onOpenSettings={systemAudio.openSettings}
      />
      {nothingToShow && (
        <Caption className="block text-center text-muted-foreground">
          Nothing to set up on this platform — recording just works.
        </Caption>
      )}
    </div>
  );
}
