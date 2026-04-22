import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useSidebarFocusStore } from '@renderer/stores/sidebarFocusStore';
import {
  useVisibleTreeItems,
  type VisibleTreeItem,
} from '@renderer/hooks/useVisibleTreeItems';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNavigateToNote } from '@renderer/navigation';
import { normalizePath } from '@renderer/lib/path';

/**
 * Vim-style keyboard navigation for the sidebar tree with "preview-on-move":
 * when j/k/h/l moves the cursor onto a file, that file opens immediately.
 * Focus stays in the sidebar — the autofocus handler in NoteEditor guards
 * against stealing focus while the sidebar root holds DOM focus.
 *
 *   j / ArrowDown   → next visible item (opens if file)
 *   k / ArrowUp     → prev visible item (opens if file)
 *   h / ArrowLeft   → expanded folder: collapse; otherwise cursor → parent
 *   l / ArrowRight  → folder: expand/descend; file: open (redundant with j/k)
 *   Enter / o       → folder: toggle; file: open (redundant with preview)
 *   Escape          → blur sidebar (cursor preserved)
 *
 * The handler is scoped to the sidebar container's onKeyDown so it only
 * runs while that element holds focus. These bindings are deliberately
 * hardcoded, not routed through shortcutsStore — they're modal.
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
      if (!loaded) return;
      // Rapid j/k can kick off several loadNoteByPath calls that resolve
      // out of order. Only navigate if this load is still the cursor
      // target — stale resolutions would otherwise yank the user back to
      // a note they've already moved past.
      const currentCursor = useSidebarFocusStore.getState().cursorPath;
      if (currentCursor !== normalized) return;
      navigateToNote(loaded.id);
    },
    [navigateToNote, loadNoteByPath],
  );

  /**
   * Move the cursor to `next` and, if it's a file, open it. Centralizing
   * here keeps the preview-on-move contract uniform across j/k/l/arrow keys.
   */
  const moveCursorTo = useCallback(
    (next: VisibleTreeItem | null | undefined) => {
      if (!next) return;
      setCursor(next.path);
      if (next.type === 'file') void openFileAt(next.path);
    },
    [setCursor, openFileAt],
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
            moveCursorTo(visibleItems[0]);
          } else if (cursorIndex < visibleItems.length - 1) {
            moveCursorTo(visibleItems[cursorIndex + 1]);
          }
          return;
        }
        case 'k':
        case 'ArrowUp': {
          event.preventDefault();
          if (cursorIndex > 0) {
            moveCursorTo(visibleItems[cursorIndex - 1]);
          } else if (cursorIndex < 0) {
            moveCursorTo(visibleItems[0]);
          }
          return;
        }
        case 'h':
        case 'ArrowLeft': {
          event.preventDefault();
          if (!current) return;
          if (current.type === 'folder' && current.isExpanded) {
            toggleExpanded(current.path);
            return;
          }
          if (current.parentPath) {
            // Moving UP to a parent folder never opens a file — folders
            // aren't notes. moveCursorTo handles the no-op correctly.
            const parent = visibleItems.find((i) => i.path === current.parentPath);
            moveCursorTo(parent);
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
              moveCursorTo(next);
            }
            return;
          }
          // On a file: navigation already happened when the cursor landed here
          // (preview-on-move). Explicit `l` is a no-op but we keep focus intent
          // clear — ensure the note is open even if cursor was set externally.
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
    [visibleItems, cursorPath, moveCursorTo, toggleExpanded, openFileAt],
  );

  return { handleKeyDown };
}
