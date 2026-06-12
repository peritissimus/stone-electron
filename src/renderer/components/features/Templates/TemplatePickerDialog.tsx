/**
 * TemplatePickerDialog — two-step modal for picking + filling a template.
 *
 * Step 1: list of templates (auto-loaded on open). Click → select.
 * Step 2: form with one input per `{{prompt:question}}`. Submit → create
 *         + navigate. If the template has no prompts, the hook
 *         auto-submits on selection and skips this step.
 *
 * Mounted once at the layout root; visibility comes from the store via
 * the useTemplates hook.
 */

import { useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, CircleNotch } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/base/ui/dialog';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Label, Body } from '@renderer/components/base/ui/text';
import { cn } from '@renderer/lib/utils';
import { useTemplates } from '@renderer/hooks/useTemplates';

export function TemplatePickerDialog() {
  const {
    open,
    step,
    templates,
    loading,
    loadedOnce,
    error,
    selected,
    answers,
    creating,
    openPicker,
    closePicker,
    select,
    back,
    setAnswer,
    submit,
  } = useTemplates();

  const handleOpenChange = (next: boolean) => {
    if (!next) closePicker();
    else openPicker();
  };

  const promptsCount = selected?.prompts.length ?? 0;
  const hasPrompts = promptsCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'picking' && (
          <>
            <DialogHeader>
              <DialogTitle>New from template</DialogTitle>
              <DialogDescription>
                Pick a template — Stone fills in the placeholders and creates the note.
              </DialogDescription>
            </DialogHeader>
            <TemplateList
              templates={templates}
              loading={!loadedOnce && loading}
              error={error}
              onSelect={select}
            />
          </>
        )}

        {step !== 'picking' && selected && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={back}
                  disabled={creating}
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Back to template list"
                >
                  <ArrowLeft size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-balance">{selected.name}</DialogTitle>
                  {selected.description && (
                    <DialogDescription className="mt-1">
                      {selected.description}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            {hasPrompts ? (
              <PromptForm
                prompts={selected.prompts}
                answers={answers}
                disabled={creating}
                error={error}
                onChange={setAnswer}
                onSubmit={submit}
              />
            ) : (
              <Body size="sm" variant="muted" className="px-1 py-4">
                Creating note…
              </Body>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================

function TemplateList({
  templates,
  loading,
  error,
  onSelect,
}: {
  templates: ReturnType<typeof useTemplates>['templates'];
  loading: boolean;
  error: string | null;
  onSelect: ReturnType<typeof useTemplates>['select'];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <CircleNotch size={20} className="animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <Body size="sm" className="px-1 py-4 text-destructive">
        {error}
      </Body>
    );
  }
  if (templates.length === 0) {
    return (
      <div className="px-1 py-4">
        <Body size="sm" variant="muted">
          No templates yet. Stone seeds a starter pack when you activate a workspace —
          if you're seeing this, the workspace folder is locked or the seed failed.
        </Body>
      </div>
    );
  }
  return (
    <ul className="-mx-1 max-h-[420px] overflow-y-auto py-1">
      {templates.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left',
              'transition-[background-color,transform] duration-150 active:scale-[0.99]',
              'hover:bg-muted',
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t.name}</span>
              {t.description && (
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {t.description}
                </span>
              )}
              {t.prompts.length > 0 && (
                <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                  {t.prompts.length} prompt{t.prompts.length === 1 ? '' : 's'}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PromptForm({
  prompts,
  answers,
  disabled,
  error,
  onChange,
  onSubmit,
}: {
  prompts: string[];
  answers: Record<string, string>;
  disabled: boolean;
  error: string | null;
  onChange: (question: string, value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  // Focus the first prompt input on mount.
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (disabled) return;
      void onSubmit();
    },
    [disabled, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-3">
        {prompts.map((question, index) => (
          <div key={question} className="space-y-1.5">
            <Label className="text-xs">{question}</Label>
            <Input
              ref={index === 0 ? firstInputRef : undefined}
              value={answers[question] ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(question, event.target.value)}
              placeholder="Optional"
            />
          </div>
        ))}
      </div>
      {error && (
        <Body size="xs" className="text-destructive">
          {error}
        </Body>
      )}
      <DialogFooter>
        <Button type="submit" disabled={disabled}>
          {disabled ? (
            <>
              <CircleNotch size={14} className="animate-spin" />
              Creating…
            </>
          ) : (
            'Create note'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
