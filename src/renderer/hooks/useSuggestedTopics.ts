import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useSuggestedTopicsStore } from '@renderer/stores/suggestedTopicsStore';

export function useSuggestedTopics() {
  const allSuggestions = useSuggestedTopicsStore((s) => s.suggestions);
  const dismissed = useSuggestedTopicsStore((s) => s.dismissed);
  const loading = useSuggestedTopicsStore((s) => s.loading);
  const adopting = useSuggestedTopicsStore((s) => s.adopting);
  const error = useSuggestedTopicsStore((s) => s.error);
  const hasLoadedOnce = useSuggestedTopicsStore((s) => s.hasLoadedOnce);
  const refresh = useSuggestedTopicsStore((s) => s.refresh);
  const dismissRaw = useSuggestedTopicsStore((s) => s.dismiss);
  const adoptRaw = useSuggestedTopicsStore((s) => s.adopt);

  useEffect(() => {
    if (!hasLoadedOnce) {
      void refresh();
    }
  }, [hasLoadedOnce, refresh]);

  const visible = useMemo(
    () => allSuggestions.filter((s) => !dismissed.has(s.id)),
    [allSuggestions, dismissed],
  );

  const dismiss = (id: string) => {
    dismissRaw(id);
  };

  const adopt = async (suggestionId: string, name: string, color?: string) => {
    const ok = await adoptRaw(suggestionId, name, color);
    if (ok) {
      toast.success(`"${name}" added to your topics`);
    } else if (useSuggestedTopicsStore.getState().error) {
      toast.error(useSuggestedTopicsStore.getState().error ?? 'Failed to adopt suggestion');
    }
    return ok;
  };

  return {
    suggestions: visible,
    loading,
    adopting,
    error,
    hasLoadedOnce,
    refresh,
    dismiss,
    adopt,
  };
}
