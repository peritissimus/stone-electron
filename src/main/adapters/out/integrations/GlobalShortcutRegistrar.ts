import { globalShortcut } from 'electron';
import type {
  IGlobalShortcutRegistrar,
  QuickCaptureShortcutStatus,
} from '../../../domain/ports/out/IGlobalShortcutRegistrar';
import { logger } from '../../../shared/utils';

/**
 * Electron-backed global shortcut registrar for the quick-capture hotkey.
 *
 * Owns the single global accelerator binding. The handler that runs when the
 * hotkey fires is injected via {@link setHandler} (the actual window-opening
 * lives in the main entry point, not here), so the adapter stays free of UI
 * concerns. Registration can fail when another app already owns the combo —
 * that's reported, not thrown, so the user can pick a different binding.
 */
export class GlobalShortcutRegistrar implements IGlobalShortcutRegistrar {
  private handler: (() => void) | null = null;
  private current: QuickCaptureShortcutStatus = { shortcut: '', registered: false };

  /** Wire the action invoked when the quick-capture hotkey fires. */
  setHandler(handler: () => void): void {
    this.handler = handler;
  }

  bindQuickCapture(accelerator: string): QuickCaptureShortcutStatus {
    const shortcut = accelerator.trim();

    // Drop the previous binding (if any) before taking the new one so we never
    // leak a stale accelerator when the user rebinds.
    if (this.current.registered && this.current.shortcut) {
      try {
        globalShortcut.unregister(this.current.shortcut);
      } catch (error) {
        logger.warn('[QuickCapture] Failed to unregister previous shortcut', {
          shortcut: this.current.shortcut,
          error,
        });
      }
    }

    if (!shortcut) {
      this.current = { shortcut: '', registered: false };
      return { ...this.current };
    }

    let registered = false;
    try {
      registered = globalShortcut.register(shortcut, () => {
        logger.info('[QuickCapture] Global shortcut triggered');
        this.handler?.();
      });
    } catch (error) {
      // Invalid accelerator strings throw rather than returning false.
      logger.warn('[QuickCapture] Failed to register global shortcut', { shortcut, error });
      registered = false;
    }

    if (registered) {
      logger.info(`✓ Global shortcut registered: ${shortcut}`);
    } else {
      logger.warn(`✗ Failed to register global shortcut (likely already in use): ${shortcut}`);
    }

    this.current = { shortcut, registered };
    return { ...this.current };
  }

  getQuickCaptureStatus(): QuickCaptureShortcutStatus {
    return { ...this.current };
  }
}
