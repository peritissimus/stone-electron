import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useSidebarFocusStore } from '@renderer/stores/sidebarFocusStore';
import { useVisibleTreeItems } from '@renderer/hooks/useVisibleTreeItems';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNavigateToNote } from '@renderer/navigation';
import { normalizePath } from '@renderer/lib/path';

/**
 * Vim-style keyboard navigation for the sidebar tree.
 *
 *   j / ArrowDown  → next visible item
 *   k / ArrowUp    → previous visible item
 *   h / ArrowLeft  → expanded folder: collapse; otherwise cursor → parent folder
 *   l / ArrowRight → folder: expand or descend into first child; file: open
 *   Enter / o      → folder: toggle; file: open
 *   Escape         → blur sidebar (cursor kept so ⌘E returns you here)
 *
 * The handler is modal: attached to the sidebar container's onKeyDown, so it
 * only runs when the container (or a focusable descendant with no competing
 * handler) holds DOM focus. We deliberately don't route these through the
 * global shortcuts store — they're meaningful only here.
 */
export function useSidebarKeyboardNav() {
  const visibleItems = useVisibleTreeItems();
  const cursorPath = useSidebarFocusStore((s) => s.cursorPath);
  const setCursor = useSidebarFocusStore((s) => s.setCursor);
  const toggleExpanded = useFileTreeStore((s) => s.toggleExpanded);
  const navigateToNote = useNavigateToNote();
  const { loadNoteByPath } = useNoteAPI();

  const openFileAt = useCallback(
    async (path: string) => {
      const normalized = normalizePath(path);
      const cached = useNoteStore.getState().notesByPath.get(normalized);
      if (cached) {
        navigateToNote(cached.id);
        return;
      }
      const loaded = await loadNoteByPath(normalized);
      if (loaded) {
        navigateToNote(loaded.id);
      }
    },
    [navigateToNote, loadNoteByPath],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // Any modifier means it's a global shortcut — let it bubble.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (visibleItems.length === 0) return;

      const cursorIndex = cursorPath
        ? visibleItems.findIndex((item) => item.path === cursorPath)
        : -1;
      const current = cursorIndex >= 0 ? visibleItems[cursorIndex] : null;

      switch (event.key) {
        case 'j':
        case 'ArrowDown': {
          event.preventDefault();
          if (cursorIndex < 0) {
            setCursor(visibleItems[0].path);
          } else if (cursorIndex < visibleItems.length - 1) {
            setCursor(visibleItems[cursorIndex + 1].path);
          }
          return;
        }
        case 'k':
        case 'ArrowUp': {
          event.preventDefault();
          if (cursorIndex > 0) {
            setCursor(visibleItems[cursorIndex - 1].path);
          } else if (cursorIndex < 0) {
            setCursor(visibleItems[0].path);
          }
          return;
        }
        case 'h':
        case 'ArrowLeft': {
          event.preventDefault();
          if (!current) return;
          if (current.type === 'folder' && current.isExpanded) {
            toggleExpanded(current.path);
          } else if (current.parentPath) {
            setCursor(current.parentPath);
          }
          return;
        }
        case 'l':
        case 'ArrowRight': {
          event.preventDefault();
          if (!current) return;
          if (current.type === 'folder') {
            if (!current.isExpanded) {
              toggleExpanded(current.path);
              return;
            }
            const next = visibleItems[cursorIndex + 1];
            if (next && next.parentPath === current.path) {
              setCursor(next.path);
            }
            return;
          }
          void openFileAt(current.path);
          return;
        }
        case 'Enter':
        case 'o': {
          event.preventDefault();
          if (!current) return;
          if (current.type === 'folder') {
            toggleExpanded(current.path);
          } else {
            void openFileAt(current.path);
          }
          return;
        }
        case 'Escape': {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }
        default:
          return;
      }
    },
    [visibleItems, cursorPath, setCursor, toggleExpanded, openFileAt],
  );

  return { handleKeyDown };
}
