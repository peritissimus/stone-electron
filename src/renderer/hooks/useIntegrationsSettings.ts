import { useEffect } from 'react';
import { useIntegrationsSettingsStore } from '@renderer/stores/integrationsSettingsStore';

export function useIntegrationsSettings() {
  const integrations = useIntegrationsSettingsStore((s) => s.integrations);
  const loaded = useIntegrationsSettingsStore((s) => s.loaded);
  const saving = useIntegrationsSettingsStore((s) => s.saving);
  const error = useIntegrationsSettingsStore((s) => s.error);
  const hydrate = useIntegrationsSettingsStore((s) => s.hydrate);
  const setLinearApiKey = useIntegrationsSettingsStore((s) => s.setLinearApiKey);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return { integrations, loaded, saving, error, setLinearApiKey };
}
