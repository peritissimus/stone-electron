/**
 * IntegrationsSettings — Settings → Integrations. Connects third-party
 * sources the Today page pulls from. Currently: a Linear personal API key.
 * Apple Calendar/Mail need no config here — they run on macOS via Automation
 * permission, prompted on first use.
 */

import { useEffect, useState } from 'react';
import { Check, LinkSimple } from '@phosphor-icons/react';
import { ContainerStack } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Caption } from '@renderer/components/base/ui/text';
import { useIntegrationsSettings } from '@renderer/hooks/useIntegrationsSettings';
import { SettingsSection } from './SettingsSection';

export function IntegrationsSettings() {
  const { integrations, loaded, saving, error, setLinearApiKey } = useIntegrationsSettings();
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
              {justSaved ? <Check size={12} weight="bold" /> : <LinkSimple size={12} weight="bold" />}
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
        description="macOS only — no setup here."
      >
        <Caption className="text-pretty text-muted-foreground">
          On macOS, today's calendar events and unread mail appear automatically. The first time,
          macOS asks permission to control Calendar and Mail; until granted, those sections stay
          empty.
        </Caption>
      </SettingsSection>
    </ContainerStack>
  );
}
