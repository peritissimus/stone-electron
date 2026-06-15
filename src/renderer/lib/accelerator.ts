/**
 * Helpers for the global quick-capture hotkey recorder.
 *
 * Converts a browser KeyboardEvent into an Electron accelerator string
 * (e.g. "Alt+Space", "CommandOrControl+Shift+Space") and formats an
 * accelerator for display (⌥Space on macOS, "Alt+Space" elsewhere).
 */

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Physical-key code → Electron accelerator key token. Returns null for bare modifiers. */
function codeToKey(code: string, key: string): string | null {
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3); // KeyA → A
  if (code.startsWith('Digit')) return code.slice(5); // Digit1 → 1
  if (code.startsWith('Arrow')) return code.slice(5); // ArrowUp → Up
  if (/^F\d{1,2}$/.test(code)) return code; // F1..F24
  switch (code) {
    case 'Enter':
    case 'NumpadEnter':
      return 'Return';
    case 'Tab':
      return 'Tab';
    case 'Backspace':
      return 'Backspace';
    case 'Delete':
      return 'Delete';
    case 'Escape':
      return 'Escape';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Backquote':
      return '`';
    default:
      break;
  }
  // Modifier-only presses report key as the modifier name — reject those.
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return null;
  // Fallback: single printable character.
  if (key.length === 1) return key.toUpperCase();
  return null;
}

/**
 * Build an Electron accelerator from a keydown event, or null if only
 * modifiers are held. At least one non-modifier key is required.
 */
export function eventToAccelerator(e: {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): string | null {
  const main = codeToKey(e.code, e.key);
  if (!main) return null;

  const mods: string[] = [];
  // Meta → CommandOrControl so the same combo works on Windows/Linux too.
  if (e.metaKey) mods.push('CommandOrControl');
  if (e.ctrlKey) mods.push('Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  return [...mods, main].join('+');
}

const MAC_SYMBOLS: Record<string, string> = {
  CommandOrControl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
};

const PC_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Command: 'Win',
  Cmd: 'Win',
  Control: 'Ctrl',
  Alt: 'Alt',
  Option: 'Alt',
  Shift: 'Shift',
};

/** Human-readable rendering of an accelerator for display in the UI. */
export function formatAccelerator(accelerator: string): string {
  if (!accelerator) return '';
  const parts = accelerator.split('+');
  if (IS_MAC) {
    return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('');
  }
  return parts.map((p) => PC_LABELS[p] ?? p).join('+');
}
