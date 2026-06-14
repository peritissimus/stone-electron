import { useEffect } from 'react';
import { useMeetingsSettingsStore } from '@renderer/stores/meetingsSettingsStore';

export function useMeetingsSettings() {
  const meetings = useMeetingsSettingsStore((s) => s.meetings);
  const loaded = useMeetingsSettingsStore((s) => s.loaded);
  const saving = useMeetingsSettingsStore((s) => s.saving);
  const error = useMeetingsSettingsStore((s) => s.error);
  const hydrate = useMeetingsSettingsStore((s) => s.hydrate);
  const setAudioRetentionDays = useMeetingsSettingsStore((s) => s.setAudioRetentionDays);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    meetings,
    loaded,
    saving,
    error,
    setAudioRetentionDays,
  };
}
