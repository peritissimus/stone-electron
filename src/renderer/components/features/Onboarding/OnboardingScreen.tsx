/**
 * OnboardingScreen — first-launch experience shown when no workspace exists
 * yet. Lets the user confirm (or change) where their notebook folder lives,
 * name it, and create it. Everything stays local, in plain Markdown.
 *
 * Rendered by MainLayout's gate; on success the new workspace is activated
 * and the gate flips to the normal app shell.
 */

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Lightning, Mountains, Warning } from 'phosphor-react';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Heading2, Body, Caption, Label } from '@renderer/components/base/ui/text';
import { useOnboarding } from '@renderer/hooks/useOnboarding';

/** Last path segment, tolerant of both posix and windows separators. */
function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function OnboardingScreen() {
  const { getDefaultWorkspacePath, selectFolder, completeOnboarding } = useOnboarding();

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
      setPath(suggested);
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

  const handleCreate = useCallback(async () => {
    if (!path || !name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const workspace = await completeOnboarding({ name, path });
      if (!workspace) {
        setError('Could not create the workspace. Try a different folder.');
      }
      // On success the workspace activates and MainLayout swaps this screen
      // out for the app shell — nothing more to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the workspace.');
    } finally {
      setCreating(false);
    }
  }, [path, name, creating, completeOnboarding]);

  const canCreate = Boolean(path) && name.trim().length > 0 && !creating;

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
          <Heading2 className="text-balance">Welcome to Stone</Heading2>
          <Body size="sm" className="mt-2 max-w-sm text-pretty text-muted-foreground">
            Your notebook lives in a folder on your computer. Choose where to keep it —
            everything stays local, in plain Markdown.
          </Body>
        </div>

        {/* Form card */}
        <div
          className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          style={{ animationDuration: '400ms', animationDelay: '120ms', animationFillMode: 'both' }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-location">Notebook location</Label>
            <div className="flex gap-2">
              <Input
                id="onboarding-location"
                value={path}
                onChange={(e) => applyPath(e.target.value)}
                placeholder="Choose a folder…"
                spellCheck={false}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleBrowse()}
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
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder="My Notebook"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) void handleCreate();
              }}
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

          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!canCreate}
            className="w-full transition-transform active:scale-[0.96]"
          >
            <Lightning size={16} weight="fill" />
            {creating ? 'Creating…' : 'Create notebook'}
          </Button>
        </div>

        <Caption
          className="mt-4 block animate-in fade-in text-center text-muted-foreground"
          style={{ animationDuration: '400ms', animationDelay: '240ms', animationFillMode: 'both' }}
        >
          You can add more workspaces anytime.
        </Caption>
      </div>
    </div>
  );
}
