/**
 * useQuickCaptureShortcut — reads and rebinds the global (OS-level)
 * quick-capture hotkey. This is a command/service hook: it owns no shared
 * renderer state, so it calls the settings API directly (per the hook rules)
 * rather than going through a store.
 */

import { useCallback, useEffect, useState } from 'react';
import { settingsAPI } from '@renderer/api/settingsAPI';
import type { QuickCaptureShortcutStatus } from '@shared/types/settings';

export function useQuickCaptureShortcut() {
  const [status, setStatus] = useState<QuickCaptureShortcutStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await settingsAPI.getQuickCaptureShortcut();
      if (response.success && response.data) setStatus(response.data);
    } catch {
      // Leave status null — UI renders an "unknown" state, stays harmless.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Persist + (re)bind. Returns the resulting status (registered may be false). */
  const setShortcut = useCallback(async (accelerator: string) => {
    setSaving(true);
    try {
      const response = await settingsAPI.setQuickCaptureShortcut(accelerator);
      if (response.success && response.data) {
        setStatus(response.data);
        return response.data;
      }
      return null;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { status, loaded, saving, refresh, setShortcut };
}
