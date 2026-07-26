/**
 * Browser-native answers for the SYSTEM channels.
 *
 * The desktop app asks the OS these questions through Electron. A browser tab
 * cannot query TCC or open System Settings, so each capability degrades to the
 * closest honest web equivalent rather than pretending to be the desktop.
 */

type MicAccessStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

/** Shown when the Local Font Access API is unavailable or denied. */
const WEB_SAFE_FONTS = [
  'Arial',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Helvetica Neue',
  'Menlo',
  'Monaco',
  'Roboto',
  'SF Mono',
  'System UI',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

interface LocalFontData {
  family: string;
}

export async function getFonts(): Promise<{ fonts: string[] }> {
  const queryLocalFonts = (
    globalThis as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> }
  ).queryLocalFonts;

  if (typeof queryLocalFonts === 'function') {
    try {
      const families = await queryLocalFonts();
      const unique = [...new Set(families.map((font) => font.family))].sort();
      if (unique.length) return { fonts: unique };
    } catch {
      // Permission denied or unsupported — fall through to the web-safe list.
    }
  }

  return { fonts: [...WEB_SAFE_FONTS] };
}

export async function getMicAccessStatus(): Promise<{ status: MicAccessStatus }> {
  if (!navigator.permissions?.query) return { status: 'unknown' };
  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (result.state === 'granted') return { status: 'granted' };
    if (result.state === 'denied') return { status: 'denied' };
    return { status: 'not-determined' };
  } catch {
    return { status: 'unknown' };
  }
}

export async function requestMicAccess(): Promise<{
  granted: boolean;
  status: MicAccessStatus;
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { granted: false, status: 'unknown' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Releasing immediately: this call exists to surface the prompt, not to record.
    for (const track of stream.getTracks()) track.stop();
    return { granted: true, status: 'granted' };
  } catch {
    return { granted: false, status: 'denied' };
  }
}

/** Capturing other apps' audio is not something a tab can do. */
export function getSystemAudioAccess(): { status: 'unsupported' } {
  return { status: 'unsupported' };
}

/**
 * Opens http(s) links in a new tab. Anything else — notably the
 * `x-apple.systempreferences:` deep links the desktop app uses to send people
 * to OS permission panes — has no browser equivalent and is refused.
 */
export function openExternal(url: string): void {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  throw new Error('Only http and https links can be opened from the browser.');
}
