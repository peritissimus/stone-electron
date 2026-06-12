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
  Lightning,
  Mountains,
  Warning,
} from 'phosphor-react';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Switch } from '@renderer/components/base/ui/switch';
import { Progress } from '@renderer/components/base/ui/progress';
import { Heading2, Body, Caption, Label } from '@renderer/components/base/ui/text';
import { useOnboarding, useModelDownloadProgress } from '@renderer/hooks/useOnboarding';
import { useAISettings } from '@renderer/hooks/useAISettings';

export interface OnboardingScreenProps {
  /** Fired after a workspace is successfully created + activated. Lets the
   *  host release the gate (including the dev force override). */
  onComplete?: () => void;
}

type StepId = 'workspace' | 'ai' | 'models';

const STEPS: StepId[] = ['workspace', 'ai', 'models'];

/** Last path segment, tolerant of both posix and windows separators. */
function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { getDefaultWorkspacePath, selectFolder, completeOnboarding } = useOnboarding();

  const [step, setStep] = useState<StepId>('workspace');
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the suggested default location on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const suggested = await getDefaultWorkspacePath();
      if (cancelled || !suggested) return;
      setPath((current) => current || suggested);
      setName((current) => (current ? current : basename(suggested)));
    })();
    return () => {
      cancelled = true;
    };
  }, [getDefaultWorkspacePath]);

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
  }, [path, name, creating, completeOnboarding, onComplete]);

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
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mountains size={28} weight="fill" />
          </div>
          <Heading2 className="text-balance">
            {step === 'workspace' && 'Welcome to Stone'}
            {step === 'ai' && 'Set up AI'}
            {step === 'models' && 'Local models'}
          </Heading2>
          <Body size="sm" className="mt-2 max-w-sm text-pretty text-muted-foreground">
            {step === 'workspace' &&
              'Your notebook lives in a folder on your computer. Choose where to keep it — everything stays local, in plain Markdown.'}
            {step === 'ai' &&
              'Optional. Cloud AI powers summaries, Ask-your-notes, and weekly status drafts. Skip it and Stone works fully offline.'}
            {step === 'models' &&
              'Stone runs search and speech-to-text on your machine. Download the models now so nothing stalls later — or skip and they download on first use.'}
          </Body>
        </div>

        {/* Step card */}
        <div
          className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          style={{ animationDuration: '400ms', animationDelay: '120ms', animationFillMode: 'both' }}
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
              onContinue={() => setStep('ai')}
            />
          )}

          {step === 'ai' && (
            <AIStep onBack={() => setStep('workspace')} onContinue={() => setStep('models')} />
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
        <Caption className="text-muted-foreground">
          We'll create this folder if it doesn't exist yet.
        </Caption>
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
            <Caption className="text-muted-foreground">
              Sends note content to your chosen provider for summaries and status reports.
              Off = fully local.
            </Caption>
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
          <Caption className="text-muted-foreground">
            Keys are stored encrypted on this machine. Add only the ones you use — you can
            manage them later in Settings → AI.
          </Caption>
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
// Step 3 — Local model downloads (with live progress)
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
            ? 'Some downloads failed — they will retry automatically on first use.'
            : 'Models ready — search and transcription are instant from day one.'}
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
