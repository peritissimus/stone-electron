/**
 * OnboardingScreen — first-launch wizard shown when no workspace exists yet.
 *
 * Three steps, everything set up in one go so nothing surprises later:
 *   1. Workspace — where the notebook folder lives + its name
 *   2. AI — cloud privacy opt-in + provider API keys (skippable)
 *   3. Local models — pre-download the embedding + Whisper models with live
 *      progress bars, so first search/transcription doesn't stall (skippable)
 *
 * The workspace is created at the very END (finish button) — quitting
 * mid-wizard leaves zero workspaces, so next launch starts the wizard over.
 * AI config + keys + model downloads persist immediately (they're global,
 * not workspace-scoped), which is fine either way.
 *
 * Rendered by MainLayout's gate; on success the new workspace is activated
 * and the gate flips to the normal app shell.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CircleNotch,
  CloudArrowUp,
  DownloadSimple,
  FolderOpen,
  Keyboard,
  Lightning,
  Warning,
} from '@phosphor-icons/react';
import { StoneLogo } from '@renderer/components/base/StoneLogo';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Switch } from '@renderer/components/base/ui/switch';
import { Progress } from '@renderer/components/base/ui/progress';
import { Heading2, Body, Caption, Label } from '@renderer/components/base/ui/text';
import { useOnboarding, useModelDownloadProgress } from '@renderer/hooks/useOnboarding';
import { useQuickCaptureShortcut } from '@renderer/hooks/useQuickCaptureShortcut';
import { eventToAccelerator, formatAccelerator } from '@renderer/lib/accelerator';
import { DevicePermissions } from '@renderer/components/composites/DevicePermissions';
import { useAISettings } from '@renderer/hooks/useAISettings';

export interface OnboardingScreenProps {
  /** Fired after a workspace is successfully created + activated. Lets the
   *  host release the gate (including the dev force override). */
  onComplete?: () => void;
}

type StepId = 'workspace' | 'permissions' | 'shortcuts' | 'ai' | 'models';

const STEPS: StepId[] = ['workspace', 'permissions', 'shortcuts', 'ai', 'models'];

/** Last path segment, tolerant of both posix and windows separators. */
function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { getDefaultWorkspacePath, selectFolder, completeOnboarding, markSteps, existingWorkspace } =
    useOnboarding();

  const [step, setStep] = useState<StepId>('workspace');
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the location field. If a workspace already exists (re-running the
  // wizard after an update added a step), read its real path/name; otherwise
  // fall back to the suggested default location.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (existingWorkspace) {
        setPath((current) => current || existingWorkspace.folderPath);
        setName((current) => (current ? current : existingWorkspace.name));
        return;
      }
      const suggested = await getDefaultWorkspacePath();
      if (cancelled || !suggested) return;
      setPath((current) => current || suggested);
      setName((current) => (current ? current : basename(suggested)));
    })();
    return () => {
      cancelled = true;
    };
  }, [getDefaultWorkspacePath, existingWorkspace]);

  // Keep the name in sync with the folder until the user types their own.
  const applyPath = useCallback(
    (next: string) => {
      setPath(next);
      if (!nameTouched) setName(basename(next));
    },
    [nameTouched],
  );

  const handleBrowse = useCallback(async () => {
    const result = await selectFolder();
    if (result && !result.canceled && result.folderPath) {
      applyPath(result.folderPath);
    }
  }, [selectFolder, applyPath]);

  const finish = useCallback(async () => {
    if (!path || !name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await markSteps({ models: true });
      const workspace = await completeOnboarding({ name, path });
      if (!workspace) {
        setError('Could not create the workspace. Try a different folder.');
      } else {
        onComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the workspace.');
    } finally {
      setCreating(false);
    }
  }, [path, name, creating, completeOnboarding, markSteps, onComplete]);

  const workspaceValid = Boolean(path) && name.trim().length > 0;
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div
          className="mb-6 flex animate-in fade-in slide-in-from-bottom-2 flex-col items-center text-center"
          style={{ animationDuration: '400ms' }}
        >
          <StoneLogo size={64} className="mb-4" />
          {/* Keyed on step so the copy crossfades when navigating. */}
          <div
            key={step}
            className="animate-in fade-in slide-in-from-bottom-1 flex flex-col items-center"
            style={{ animationDuration: '250ms' }}
          >
            <Heading2 className="text-balance">
              {step === 'workspace' && 'Welcome to Stone'}
              {step === 'permissions' && 'Permissions'}
              {step === 'shortcuts' && 'Quick capture'}
              {step === 'ai' && 'Set up AI'}
              {step === 'models' && 'Local models'}
            </Heading2>
            <Body size="sm" className="mt-2 max-w-sm text-pretty text-muted-foreground">
              {step === 'workspace' && 'Your notes live in a folder on this computer. Plain Markdown, fully local.'}
              {step === 'permissions' && 'For recording meetings and voice notes. Optional.'}
              {step === 'shortcuts' && 'A global hotkey to capture a thought from anywhere — even when Stone is in the background.'}
              {step === 'ai' && 'Optional. Powers summaries and weekly reports. Stone works fully offline without it.'}
              {step === 'models' && 'Search and transcription run on-device. Download now, or on first use.'}
            </Body>
          </div>
        </div>

        {/* Step card */}
        <div
          className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          style={{ animationDuration: '400ms', animationDelay: '120ms', animationFillMode: 'both' }}
        >
          {/* Keyed on step so each step's form slides in instead of snapping. */}
          <div
            key={step}
            className="animate-in fade-in slide-in-from-bottom-1"
            style={{ animationDuration: '250ms' }}
          >
          {step === 'workspace' && (
            <WorkspaceStep
              path={path}
              name={name}
              onPathChange={applyPath}
              onBrowse={() => void handleBrowse()}
              onNameChange={(value) => {
                setNameTouched(true);
                setName(value);
              }}
              canContinue={workspaceValid}
              onContinue={() => setStep('permissions')}
            />
          )}

          {step === 'permissions' && (
            <PermissionsStep
              onBack={() => setStep('workspace')}
              onContinue={() => {
                void markSteps({ permissions: true });
                setStep('shortcuts');
              }}
            />
          )}

          {step === 'shortcuts' && (
            <ShortcutsStep
              onBack={() => setStep('permissions')}
              onContinue={() => {
                void markSteps({ shortcuts: true });
                setStep('ai');
              }}
            />
          )}

          {step === 'ai' && (
            <AIStep
              onBack={() => setStep('shortcuts')}
              onContinue={() => {
                void markSteps({ ai: true });
                setStep('models');
              }}
            />
          )}

          {step === 'models' && (
            <ModelsStep
              creating={creating}
              error={error}
              onBack={() => setStep('ai')}
              onFinish={() => void finish()}
            />
          )}
          </div>
        </div>

        {/* Step dots */}
        <div
          className="mt-4 flex animate-in fade-in items-center justify-center gap-1.5"
          style={{ animationDuration: '400ms', animationDelay: '240ms', animationFillMode: 'both' }}
          aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((id, i) => (
            <span
              key={id}
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-200',
                i === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Step 1 — Workspace
// =============================================================================

function WorkspaceStep({
  path,
  name,
  onPathChange,
  onBrowse,
  onNameChange,
  canContinue,
  onContinue,
}: {
  path: string;
  name: string;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onNameChange: (value: string) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="onboarding-location">Notebook location</Label>
        <div className="flex gap-2">
          <Input
            id="onboarding-location"
            value={path}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="Choose a folder…"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onBrowse}
            className="shrink-0 transition-transform active:scale-[0.96]"
          >
            <FolderOpen size={16} />
            Browse
          </Button>
        </div>
        <Caption className="text-muted-foreground">Created if it doesn't exist.</Caption>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-name">Workspace name</Label>
        <Input
          id="onboarding-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="My Notebook"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canContinue) onContinue();
          }}
        />
      </div>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full transition-transform active:scale-[0.96]"
      >
        Continue
      </Button>
    </div>
  );
}

// =============================================================================
// Step 2 — AI privacy + provider keys
// =============================================================================

function AIStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const { ai, providerKeys, keysLoaded, hydrateProviderKeys, updatePrivacy, setProviderKey } =
    useAISettings();

  useEffect(() => {
    if (!keysLoaded) void hydrateProviderKeys();
  }, [keysLoaded, hydrateProviderKeys]);

  const cloudOn = ai.privacy.allowCloudInference;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-3">
        <div className="flex items-start gap-2.5">
          <CloudArrowUp size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">Enable cloud AI</div>
            <Caption className="text-muted-foreground">Sends notes to your provider. Off = fully local.</Caption>
          </div>
        </div>
        <Switch
          checked={cloudOn}
          onCheckedChange={(checked) =>
            void updatePrivacy({
              allowCloudInference: checked,
              allowSendingNoteContent: checked,
              allowSendingMetadata: checked,
            })
          }
          aria-label="Enable cloud AI"
        />
      </div>

      {cloudOn && (
        <div className="space-y-2">
          <Label>Provider API keys</Label>
          {!keysLoaded && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <CircleNotch size={12} className="animate-spin" />
              Loading…
            </div>
          )}
          {keysLoaded &&
            providerKeys.map((status) => (
              <ProviderKeyRow
                key={status.provider}
                provider={status.provider}
                label={status.label}
                stored={status.hasStoredKey}
                fromEnv={status.hasEnvKey}
                onSave={(key) => setProviderKey(status.provider, key)}
              />
            ))}
          <Caption className="text-muted-foreground">Stored encrypted on this device.</Caption>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="transition-transform active:scale-[0.96]"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="flex-1 transition-transform active:scale-[0.96]"
        >
          {cloudOn ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}

function ProviderKeyRow({
  provider,
  label,
  stored,
  fromEnv,
  onSave,
}: {
  provider: string;
  label: string;
  stored: boolean;
  fromEnv: boolean;
  onSave: (key: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(stored);

  const handleSave = async () => {
    const key = value.trim();
    if (!key || saving) return;
    setSaving(true);
    try {
      await onSave(key);
      setSaved(true);
      setValue('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-foreground">{label}</span>
      <Input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={saved ? '••••••••  stored' : fromEnv ? 'from env var' : `${provider} API key`}
        className="h-8 flex-1 text-xs"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
        }}
      />
      {saved && !value ? (
        <span className="flex size-8 shrink-0 items-center justify-center text-emerald-600">
          <Check size={14} weight="bold" />
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSave()}
          disabled={!value.trim() || saving}
          className="shrink-0 transition-transform active:scale-[0.96]"
        >
          {saving ? <CircleNotch size={12} className="animate-spin" /> : 'Save'}
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Step 2 — Permissions (microphone + system audio)
// =============================================================================

function PermissionsStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <DevicePermissions />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="transition-transform active:scale-[0.96]"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="flex-1 transition-transform active:scale-[0.96]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Step — Quick capture global hotkey
// =============================================================================

function ShortcutsStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const { status, loaded, saving, setShortcut } = useQuickCaptureShortcut();
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState(false);

  // While recording, capture the next key combo globally (capture phase so the
  // app's own shortcuts don't swallow it first). Esc cancels.
  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }
      const accelerator = eventToAccelerator(e);
      if (!accelerator) return; // modifier-only — keep waiting for a real key
      setRecording(false);
      void (async () => {
        const result = await setShortcut(accelerator);
        setConflict(Boolean(result && !result.registered && result.shortcut.length > 0));
      })();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording, setShortcut]);

  const shortcut = status?.shortcut ?? '';
  const registered = status?.registered ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
        <div className="flex items-start gap-2.5">
          <Keyboard size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">Quick capture hotkey</div>
            <Caption className="text-muted-foreground">
              Opens a capture window from any app.
            </Caption>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {recording ? (
            <span className="rounded-md border border-primary/50 bg-primary/5 px-2 py-1 text-xs text-primary">
              Press keys…
            </span>
          ) : (
            <kbd className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium tabular-nums text-foreground">
              {shortcut ? formatAccelerator(shortcut) : 'Not set'}
            </kbd>
          )}
          {!recording && shortcut && loaded && (
            registered ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check size={11} weight="bold" />
              </span>
            ) : (
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Warning size={11} weight="fill" />
              </span>
            )
          )}
        </div>
      </div>

      {conflict && !recording && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
          <Body size="sm" className="text-destructive">
            {shortcut ? `${formatAccelerator(shortcut)} is already in use by another app.` : 'That combo is unavailable.'}{' '}
            Record a different one.
          </Body>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setConflict(false);
          setRecording(true);
        }}
        disabled={saving || recording}
        className="w-full transition-transform active:scale-[0.96]"
      >
        {recording ? 'Press a key combination… (Esc to cancel)' : 'Record a different shortcut'}
      </Button>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="transition-transform active:scale-[0.96]"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="flex-1 transition-transform active:scale-[0.96]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 4 — Local model downloads (with live progress)
// =============================================================================

type ModelDownloadState = 'idle' | 'running' | 'ready' | 'failed';

function ModelsStep({
  creating,
  error,
  onBack,
  onFinish,
}: {
  creating: boolean;
  error: string | null;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { warmUpEmbeddings, warmUpWhisper } = useOnboarding();
  const progress = useModelDownloadProgress();

  const [embeddingState, setEmbeddingState] = useState<ModelDownloadState>('idle');
  const [whisperState, setWhisperState] = useState<ModelDownloadState>('idle');

  const downloading = embeddingState === 'running' || whisperState === 'running';
  const finished =
    (embeddingState === 'ready' || embeddingState === 'failed') &&
    (whisperState === 'ready' || whisperState === 'failed');

  const handleDownload = async () => {
    // Sequential — both models share one worker thread, and one bar at a
    // time reads more honestly than two crawling in lockstep.
    setEmbeddingState('running');
    const embeddingOk = await warmUpEmbeddings();
    setEmbeddingState(embeddingOk ? 'ready' : 'failed');

    setWhisperState('running');
    const whisperOk = await warmUpWhisper();
    setWhisperState(whisperOk ? 'ready' : 'failed');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <ModelRow
          name="Search & topics"
          detail="BGE-small embeddings · ~35 MB"
          state={embeddingState}
          progress={embeddingState === 'running' ? progress.embedding : null}
        />
        <ModelRow
          name="Speech-to-text"
          detail="Whisper base · ~80 MB"
          state={whisperState}
          progress={whisperState === 'running' ? progress.whisper : null}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
          <Body size="sm" className="text-destructive">
            {error}
          </Body>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={downloading || creating}
          className="transition-transform active:scale-[0.96]"
        >
          Back
        </Button>

        {embeddingState === 'idle' && whisperState === 'idle' ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={onFinish}
              disabled={creating}
              className="transition-transform active:scale-[0.96]"
            >
              Skip
            </Button>
            <Button
              type="button"
              onClick={() => void handleDownload()}
              disabled={creating}
              className="flex-1 transition-transform active:scale-[0.96]"
            >
              <DownloadSimple size={16} weight="bold" />
              Download models
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={onFinish}
            disabled={downloading || creating}
            className="flex-1 transition-transform active:scale-[0.96]"
          >
            {creating ? (
              <>
                <CircleNotch size={16} className="animate-spin" />
                Creating…
              </>
            ) : downloading ? (
              <>
                <CircleNotch size={16} className="animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <Lightning size={16} weight="fill" />
                Create notebook
              </>
            )}
          </Button>
        )}
      </div>

      {finished && (
        <Caption className="block text-center text-muted-foreground">
          {embeddingState === 'failed' || whisperState === 'failed'
            ? 'Some downloads failed. They retry on first use.'
            : 'Ready.'}
        </Caption>
      )}
    </div>
  );
}

function ModelRow({
  name,
  detail,
  state,
  progress,
}: {
  name: string;
  detail: string;
  state: ModelDownloadState;
  progress: { percent: number; loadedBytes: number; totalBytes: number } | null;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{name}</div>
          <Caption className="text-muted-foreground">{detail}</Caption>
        </div>
        {state === 'running' && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress ? `${progress.percent}%` : ''}
          </span>
        )}
        {state === 'running' && <CircleNotch size={14} className="animate-spin text-primary" />}
        {state === 'ready' && (
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check size={11} weight="bold" />
          </span>
        )}
        {state === 'failed' && (
          <span className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Warning size={11} weight="fill" />
          </span>
        )}
      </div>
      {state === 'running' && (
        <div className="mt-2.5">
          <Progress value={progress?.percent ?? 0} className="h-1.5" />
          {progress && progress.totalBytes > 0 && (
            <Caption className="mt-1 block tabular-nums text-muted-foreground">
              {formatMB(progress.loadedBytes)} / {formatMB(progress.totalBytes)} MB
            </Caption>
          )}
        </div>
      )}
    </div>
  );
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
