/**
 * IGlobalShortcutRegistrar (OUT port)
 *
 * Abstracts the OS-level global shortcut registration (Electron's
 * `globalShortcut`) so use cases can (re)bind the quick-capture hotkey without
 * importing Electron. The adapter owns the actual accelerator wiring and the
 * handler that runs when the hotkey fires.
 */

export interface QuickCaptureShortcutStatus {
  /** The accelerator we attempted to bind (empty string → intentionally none). */
  shortcut: string;
  /** True when the accelerator is currently registered with the OS. */
  registered: boolean;
}

export interface IGlobalShortcutRegistrar {
  /**
   * Bind the quick-capture global hotkey to the given Electron accelerator,
   * replacing any previous binding. An empty/blank accelerator unbinds and
   * reports `registered: false`. Returns whether the OS accepted it (false when
   * another app already owns the combo).
   */
  bindQuickCapture(accelerator: string): QuickCaptureShortcutStatus;

  /** Current status of the quick-capture hotkey. */
  getQuickCaptureStatus(): QuickCaptureShortcutStatus;
}
