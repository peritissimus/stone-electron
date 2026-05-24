import { useEffect } from 'react';
import { useAISettingsStore } from '@renderer/stores/aiSettingsStore';

export function useAISettings() {
  const ai = useAISettingsStore((s) => s.ai);
  const providerKeys = useAISettingsStore((s) => s.providerKeys);
  const loaded = useAISettingsStore((s) => s.loaded);
  const keysLoaded = useAISettingsStore((s) => s.keysLoaded);
  const saving = useAISettingsStore((s) => s.saving);
  const error = useAISettingsStore((s) => s.error);
  const hydrate = useAISettingsStore((s) => s.hydrate);
  const hydrateProviderKeys = useAISettingsStore((s) => s.hydrateProviderKeys);
  const updateIndexing = useAISettingsStore((s) => s.updateIndexing);
  const updateModels = useAISettingsStore((s) => s.updateModels);
  const updatePrivacy = useAISettingsStore((s) => s.updatePrivacy);
  const setProviderKey = useAISettingsStore((s) => s.setProviderKey);
  const deleteProviderKey = useAISettingsStore((s) => s.deleteProviderKey);
  const resetAI = useAISettingsStore((s) => s.resetAI);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    ai,
    providerKeys,
    loaded,
    keysLoaded,
    saving,
    error,
    hydrateProviderKeys,
    updateIndexing,
    updateModels,
    updatePrivacy,
    setProviderKey,
    deleteProviderKey,
    resetAI,
  };
}
