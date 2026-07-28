import type { IGlobalShortcutRegistrar, QuickCaptureShortcutStatus } from '../../../domain';

/**
 * Headless implementation: the browser owns keyboard shortcuts while focused,
 * so there is no OS-global registration in the server process.
 */
export class ServerGlobalShortcutRegistrar implements IGlobalShortcutRegistrar {
  private current: QuickCaptureShortcutStatus = {
    shortcut: '',
    registered: false,
  };

  bindQuickCapture(accelerator: string): QuickCaptureShortcutStatus {
    this.current = {
      shortcut: accelerator.trim(),
      registered: false,
    };
    return { ...this.current };
  }

  getQuickCaptureStatus(): QuickCaptureShortcutStatus {
    return { ...this.current };
  }
}
