/**
 * Keyboard Shortcuts Settings Component
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  useShortcuts,
  DEFAULT_SHORTCUTS,
  formatShortcutDisplay,
  type ShortcutDefinition,
  type ShortcutAction,
  type ShortcutBinding,
} from '@renderer/hooks/useShortcuts';
import { useQuickCaptureShortcut } from '@renderer/hooks/useQuickCaptureShortcut';
import { eventToAccelerator, formatAccelerator } from '@renderer/lib/accelerator';
import { SettingsSection } from './SettingsSection';
import { Button } from '@renderer/components/base/ui/button';
import { Label } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { cn } from '@renderer/lib/utils';

/**
 * Quick-capture global (OS-level) hotkey row. Unlike the in-app chords below,
 * this is an Electron accelerator and may fail to register if another app owns
 * it — registration status is shown inline.
 */
function GlobalQuickCaptureRow() {
  const { status, loaded, saving, setShortcut } = useQuickCaptureShortcut();
  const [recording, setRecording] = useState(false);

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
      if (!accelerator) return;
      setRecording(false);
      void (async () => {
        const result = await setShortcut(accelerator);
        if (result && !result.registered && result.shortcut) {
          toast.error(`${formatAccelerator(result.shortcut)} is already in use by another app.`);
        }
      })();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording, setShortcut]);

  const shortcut = status?.shortcut ?? '';
  const registered = status?.registered ?? false;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Quick capture</span>
          {loaded && shortcut && !registered && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
              Unavailable
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Open a capture window from any app (global hotkey)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRecording(true)}
          disabled={saving}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-mono tabular-nums',
            'bg-muted/50 hover:bg-muted border border-border',
            'transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
            recording && 'border-primary text-primary',
          )}
        >
          {recording ? 'Press keys…' : shortcut ? formatAccelerator(shortcut) : 'Not set'}
        </button>
        {shortcut && (
          <button
            type="button"
            onClick={() => void setShortcut('')}
            className={cn(
              'p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
            )}
            title="Clear global hotkey"
          >
            <ArrowClockwise size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface ShortcutRowProps {
  shortcut: ShortcutDefinition;
  isCustomized: boolean;
  onEdit: () => void;
  onReset: () => void;
}

function ShortcutRow({ shortcut, isCustomized, onEdit, onReset }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{shortcut.label}</span>
          {isCustomized && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              Modified
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{shortcut.description}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-mono tabular-nums',
            'bg-muted/50 hover:bg-muted',
            'border border-border',
            'transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
          )}
        >
          {formatShortcutDisplay(shortcut)}
        </button>
        {isCustomized && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
            )}
            title="Reset to default"
          >
            <ArrowClockwise size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface ShortcutEditorProps {
  shortcut: ShortcutDefinition;
  onSave: (binding: ShortcutBinding) => void;
  onCancel: () => void;
}

function ShortcutEditor({ shortcut, onSave, onCancel }: ShortcutEditorProps) {
  const [recording, setRecording] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<ShortcutBinding>({
    key: shortcut.key,
    metaKey: shortcut.metaKey,
    shiftKey: shortcut.shiftKey,
    altKey: shortcut.altKey,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return;

      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        return;
      }

      // Must have at least Cmd/Ctrl
      if (!e.metaKey && !e.ctrlKey) {
        return;
      }

      setCurrentBinding({
        key: e.key.toLowerCase(),
        metaKey: e.metaKey || e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      });
      setRecording(false);
    },
    [recording],
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [recording, handleKeyDown]);

  const displayBinding: ShortcutDefinition = {
    ...shortcut,
    ...currentBinding,
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
      <div className="bg-popover rounded-xl border border-border p-6 w-[400px] shadow-xl">
        <h3 className="text-lg font-semibold mb-1">Edit Shortcut</h3>
        <p className="text-sm text-muted-foreground mb-6">{shortcut.label}</p>

        <div className="flex flex-col items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => setRecording(true)}
            className={cn(
              'w-full py-6 rounded-lg border-2 border-dashed',
              'transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]',
              recording
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground',
            )}
          >
            {recording ? (
              <span className="text-sm text-primary animate-pulse">
                Press your shortcut keys…
              </span>
            ) : (
              <span className="text-2xl font-mono tabular-nums">
                {formatShortcutDisplay(displayBinding)}
              </span>
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            Click above and press your desired shortcut
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(currentBinding)}>Save</Button>
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcutsSettings() {
  const { getShortcut, setShortcut, resetShortcut, resetAllShortcuts, isCustomized } =
    useShortcuts();
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);

  // Group shortcuts by category
  const categories = {
    general: DEFAULT_SHORTCUTS.filter((s) => s.category === 'general'),
    navigation: DEFAULT_SHORTCUTS.filter((s) => s.category === 'navigation'),
    editor: DEFAULT_SHORTCUTS.filter((s) => s.category === 'editor'),
  };

  const handleSave = async (binding: ShortcutBinding) => {
    if (!editingShortcut) return;
    try {
      await setShortcut(editingShortcut, binding);
      setEditingShortcut(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shortcut';
      toast.error(message);
    }
  };

  const handleReset = async (id: ShortcutAction) => {
    try {
      await resetShortcut(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset shortcut';
      toast.error(message);
    }
  };

  const handleResetAll = async () => {
    try {
      await resetAllShortcuts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset shortcuts';
      toast.error(message);
    }
  };

  const categoryLabels: Record<string, string> = {
    general: 'General',
    navigation: 'Navigation',
    editor: 'Editor',
  };

  return (
    <SettingsSection
      title="Keyboard Shortcuts"
      description="Click any shortcut to record a new chord. Cmd/Ctrl is required."
      action={
        <Button variant="ghost" size="sm" onClick={handleResetAll}>
          <ArrowClockwise size={14} className="mr-1" />
          Reset All
        </Button>
      }
    >
      <ContainerStack gap="lg">
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
            Global
          </Label>
          <div className="space-y-1">
            <GlobalQuickCaptureRow />
          </div>
          <Separator className="mt-4" />
        </div>

        {Object.entries(categories).map(([category, shortcuts]) => (
          <div key={category}>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {categoryLabels[category]}
            </Label>
            <div className="space-y-1">
              {shortcuts.map((defaultShortcut) => {
                const shortcut = getShortcut(defaultShortcut.id);
                return (
                  <ShortcutRow
                    key={shortcut.id}
                    shortcut={shortcut}
                    isCustomized={isCustomized(shortcut.id)}
                    onEdit={() => setEditingShortcut(shortcut.id)}
                    onReset={() => handleReset(shortcut.id)}
                  />
                );
              })}
            </div>
            {category !== 'editor' && <Separator className="mt-4" />}
          </div>
        ))}

      </ContainerStack>

      {editingShortcut && (
        <ShortcutEditor
          shortcut={getShortcut(editingShortcut)}
          onSave={handleSave}
          onCancel={() => setEditingShortcut(null)}
        />
      )}
    </SettingsSection>
  );
}
