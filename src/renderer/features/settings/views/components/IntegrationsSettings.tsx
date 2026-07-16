/**
 * IntegrationsSettings — Settings → Integrations. Connects third-party
 * sources the Today page pulls from. Currently: a Linear personal API key.
 * Apple Calendar/Mail need no account config here. Calendar uses macOS
 * Calendar privacy access; Mail uses Automation access.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowSquareOut,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  Envelope,
  LinkSimple,
  Warning,
} from '@phosphor-icons/react';
import { Checkbox, ContainerStack } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Caption } from '@renderer/components/base/ui/text';
import { useIntegrationsSettings } from '@renderer/features/settings/hooks/useIntegrationsSettings';
import {
  useDailyReviewIntegrations,
  type IntegrationLoadState,
} from '@renderer/features/daily-review/hooks/useDailyReviewIntegrations';
import type { CalendarDescriptor, DailyReviewIntegrationSource } from '@shared/types';
import { SettingsSection } from './SettingsSection';

export function IntegrationsSettings() {
  const {
    integrations,
    loaded,
    saving,
    error,
    calendarError,
    availableCalendars,
    calendarAccess,
    refreshCalendars,
    setLinearApiKey,
    setSelectedCalendarIds,
  } = useIntegrationsSettings();
  const {
    integrations: access,
    checkAccess,
    openIntegrationSettings,
  } = useDailyReviewIntegrations();
  const [draft, setDraft] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Seed the field from the stored key once it loads (and after external changes).
  useEffect(() => {
    setDraft(integrations.linearApiKey);
  }, [integrations.linearApiKey]);

  const dirty = draft.trim() !== integrations.linearApiKey;

  const save = async () => {
    await setLinearApiKey(draft.trim());
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <ContainerStack gap="xl">
      <SettingsSection
        title="Linear"
        description="Show your assigned open issues on the Today page."
      >
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={draft}
              disabled={!loaded || saving}
              placeholder="Linear personal API key (lin_api_…)"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 font-mono text-xs"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) void save();
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => void save()}
              className="shrink-0 transition-transform active:scale-[0.96]"
            >
              {justSaved ? (
                <Check size={12} weight="bold" />
              ) : (
                <LinkSimple size={12} weight="bold" />
              )}
              {justSaved ? 'Saved' : integrations.linearApiKey ? 'Update' : 'Connect'}
            </Button>
          </div>
          <Caption className="mt-2 block text-pretty text-muted-foreground">
            Create a personal API key at linear.app → Settings → Security & access → Personal API
            keys. Stored locally on this device.
          </Caption>
          {error && <Caption className="mt-1 block text-destructive">{error}</Caption>}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Apple Calendar & Mail"
        description="Control which local Apple data can contribute to Today. Data stays on this Mac."
      >
        <div className="grid gap-3">
          <IntegrationPermissionRow
            source="calendar"
            title="Calendar"
            description="Show today's events and locations."
            icon={<CalendarBlank size={18} />}
            state={calendarAccess}
            onCheck={() => void refreshCalendars()}
            onOpenSettings={() => void openIntegrationSettings('calendar')}
          />
          {calendarAccess.status === 'connected' && availableCalendars.length > 0 && (
            <CalendarSelectionPanel
              calendars={availableCalendars}
              selectedIds={integrations.selectedCalendarIds}
              saving={saving}
              error={calendarError}
              onChange={(ids) => void setSelectedCalendarIds(ids)}
            />
          )}
          <IntegrationPermissionRow
            source="mail"
            title="Mail"
            description="Show the unified unread count from Apple Mail."
            icon={<Envelope size={18} />}
            state={access.mail}
            onCheck={() => void checkAccess('mail')}
            onOpenSettings={() => void openIntegrationSettings('mail')}
          />
        </div>
        <Caption className="text-pretty text-muted-foreground">
          Calendar access is managed under Privacy &amp; Security → Calendars. Apple Mail access is
          managed under Privacy &amp; Security → Automation.
        </Caption>
      </SettingsSection>
    </ContainerStack>
  );
}

function CalendarSelectionPanel({
  calendars,
  selectedIds,
  saving,
  error,
  onChange,
}: {
  calendars: CalendarDescriptor[];
  selectedIds: string[] | null;
  saving: boolean;
  error: string | null;
  onChange: (ids: string[] | null) => void;
}) {
  const allIds = calendars.map((calendar) => calendar.id);
  const selected = selectedIds === null ? new Set(allIds) : new Set(selectedIds);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;

  const toggleCalendar = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next.size === allIds.length ? null : allIds.filter((item) => next.has(item)));
  };

  return (
    <div className="rounded-xl bg-muted/30 p-2 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.35)]">
      <div className="flex min-h-10 items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">Calendars included in Today</span>
          <Caption className="ml-2 tabular-nums text-muted-foreground">
            {selectedCount === allIds.length
              ? `All ${allIds.length}`
              : `${selectedCount} of ${allIds.length}`}
          </Caption>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 transition-transform active:scale-[0.96]"
            disabled={saving || selectedIds === null}
            onClick={() => onChange(null)}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 transition-transform active:scale-[0.96]"
            disabled={saving || selectedCount === 0}
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="grid gap-1">
        {calendars.map((calendar) => {
          const checked = selected.has(calendar.id);
          return (
            <label
              key={calendar.id}
              className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-background/70"
            >
              <Checkbox
                checked={checked}
                disabled={saving}
                onCheckedChange={(value) => toggleCalendar(calendar.id, value === true)}
              />
              <span className="min-w-0 flex-1 text-pretty text-sm">{calendar.title}</span>
              {calendar.source && (
                <Caption className="max-w-40 truncate text-muted-foreground">
                  {calendar.source}
                </Caption>
              )}
            </label>
          );
        })}
      </div>
      {error && <Caption className="block px-2 py-1 text-destructive">{error}</Caption>}
    </div>
  );
}

function IntegrationPermissionRow({
  source,
  title,
  description,
  icon,
  state,
  onCheck,
  onOpenSettings,
}: {
  source: DailyReviewIntegrationSource;
  title: string;
  description: string;
  icon: ReactNode;
  state: IntegrationLoadState;
  onCheck: () => void;
  onOpenSettings: () => void;
}) {
  const denied = state.status === 'denied';
  const loading = state.status === 'loading';
  const unavailable = state.status === 'unavailable';
  const connected = state.status === 'connected';
  const statusLabel = connected
    ? 'Connected'
    : denied
      ? 'Access denied'
      : unavailable
        ? 'Unavailable'
        : state.status === 'error'
          ? 'Needs attention'
          : loading
            ? 'Checking access…'
            : 'Not checked';

  return (
    <div className="flex min-h-20 items-center gap-3 rounded-xl bg-muted/40 p-3 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.35)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span
            className={
              connected
                ? 'inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400'
                : denied || state.status === 'error'
                  ? 'inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400'
                  : 'inline-flex items-center gap-1 text-[11px] text-muted-foreground'
            }
          >
            {loading ? (
              <CircleNotch size={11} className="animate-spin" />
            ) : connected ? (
              <CheckCircle size={11} weight="fill" />
            ) : denied || state.status === 'error' ? (
              <Warning size={11} weight="fill" />
            ) : null}
            {statusLabel}
          </span>
        </div>
        <Caption className="mt-0.5 block text-pretty text-muted-foreground">
          {state.message ?? description}
        </Caption>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {denied && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={onOpenSettings}
          >
            <ArrowSquareOut size={13} />
            System Settings
          </Button>
        )}
        {!unavailable && (
          <Button
            type="button"
            variant={denied ? 'ghost' : 'outline'}
            size="sm"
            className="h-10"
            disabled={loading}
            onClick={onCheck}
            aria-label={`Check ${source} access`}
          >
            {loading && <CircleNotch size={13} className="animate-spin" />}
            {state.status === 'idle' ? 'Request access' : 'Check again'}
          </Button>
        )}
      </div>
    </div>
  );
}
