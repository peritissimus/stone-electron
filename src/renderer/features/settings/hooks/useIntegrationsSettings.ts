import { useEffect } from 'react';
import { useIntegrationsSettingsStore } from '@renderer/features/settings/model/integrationsSettingsStore';

export function useIntegrationsSettings() {
  const integrations = useIntegrationsSettingsStore((s) => s.integrations);
  const loaded = useIntegrationsSettingsStore((s) => s.loaded);
  const saving = useIntegrationsSettingsStore((s) => s.saving);
  const error = useIntegrationsSettingsStore((s) => s.error);
  const calendarError = useIntegrationsSettingsStore((s) => s.calendarError);
  const availableCalendars = useIntegrationsSettingsStore((s) => s.availableCalendars);
  const calendarAccess = useIntegrationsSettingsStore((s) => s.calendarAccess);
  const hydrate = useIntegrationsSettingsStore((s) => s.hydrate);
  const refreshCalendars = useIntegrationsSettingsStore((s) => s.refreshCalendars);
  const setLinearApiKey = useIntegrationsSettingsStore((s) => s.setLinearApiKey);
  const setSelectedCalendarIds = useIntegrationsSettingsStore((s) => s.setSelectedCalendarIds);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void refreshCalendars();
  }, [refreshCalendars]);

  return {
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
  };
}
