/**
 * Sidebar Focus Store
 *
 * Tracks the keyboard-navigation cursor (a single visible tree-item path)
 * and a "pending focus" flag that the Sidebar consumes to move DOM focus
 * into its container.
 *
 * Deliberately separate from useTreeSelection — that hook derives the
 * "active note's folder/file" from the route. The cursor here represents
 * navigation intent, which is independent of the currently-open note and
 * can differ from it (e.g. ⌘E to browse the tree without opening anything).
 */

import { create } from 'zustand';

interface SidebarFocusState {
  cursorPath: string | null;
  /** Set by requestFocus(); cleared by the Sidebar once it has moved DOM focus. */
  pendingFocus: boolean;

  setCursor: (path: string | null) => void;

  /**
   * Arm the cursor and ask the Sidebar to grab DOM focus. The Sidebar may
   * be mounting (e.g. after toggleSidebar opens it) or already mounted —
   * either way, an effect inside it will see pendingFocus and invoke focus
   * on its container ref.
   */
  requestFocus: (path: string | null) => void;

  /** Called by the Sidebar after it has acted on pendingFocus. */
  acknowledgeFocus: () => void;
}

export const useSidebarFocusStore = create<SidebarFocusState>((set) => ({
  cursorPath: null,
  pendingFocus: false,

  setCursor: (path) => set({ cursorPath: path }),

  requestFocus: (path) =>
    set({
      cursorPath: path,
      pendingFocus: true,
    }),

  acknowledgeFocus: () => set({ pendingFocus: false }),
}));
