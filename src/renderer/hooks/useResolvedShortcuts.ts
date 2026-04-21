/**
 * useResolvedShortcuts — memoized resolver over defaults + sparse overrides.
 *
 * Returns the canonical chord-string ResolvedShortcuts used by the editor
 * extension factory (Step 6) and by any future code that needs the full
 * binding map for both app and editor scopes.
 *
 * Components targeting only the legacy app-shortcut surface should keep
 * using useShortcuts() — this hook is for callers that need editor-scope
 * bindings or chord strings (not the {key, metaKey, ...} object form).
 */

import { useMemo } from 'react';
import { useShortcutsStore } from '@renderer/stores/shortcutsStore';
import { resolveShortcuts, type ResolvedShortcuts } from '@shared/utils/shortcuts';

export function useResolvedShortcuts(): ResolvedShortcuts {
  const overrides = useShortcutsStore((s) => s.overrides);
  return useMemo(() => resolveShortcuts(overrides), [overrides]);
}
