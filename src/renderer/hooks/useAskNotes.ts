/**
 * useAskNotes - hook over the AI ask store.
 *
 * Components read the panel state through this hook and trigger asks via
 * `submit`. State lives in aiAskStore so the panel can mount/unmount without
 * losing the last answer.
 */

import { useCallback } from 'react';
import { useAIAskStore } from '@renderer/stores/aiAskStore';

export function useAskNotes() {
  const query = useAIAskStore((s) => s.query);
  const answer = useAIAskStore((s) => s.answer);
  const sources = useAIAskStore((s) => s.sources);
  const loading = useAIAskStore((s) => s.loading);
  const error = useAIAskStore((s) => s.error);
  const history = useAIAskStore((s) => s.history);
  const lastAskedAt = useAIAskStore((s) => s.lastAskedAt);
  const setQuery = useAIAskStore((s) => s.setQuery);
  const ask = useAIAskStore((s) => s.ask);
  const clear = useAIAskStore((s) => s.clear);

  const submit = useCallback(
    async (override?: string) => {
      await ask(override);
    },
    [ask],
  );

  return {
    query,
    answer,
    sources,
    loading,
    error,
    history,
    lastAskedAt,
    setQuery,
    submit,
    clear,
  };
}
