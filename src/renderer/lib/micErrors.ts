/**
 * Map getUserMedia failures to actionable copy. The DOMException names are
 * standardized; "NotAllowedError" on macOS means TCC denied the app (or the
 * user dismissed the prompt) — the fix lives in System Settings, so say so
 * instead of surfacing a raw "Permission denied" string.
 */
export function describeMicError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Microphone access is denied. Enable Stone under System Settings → Privacy & Security → Microphone, then try again.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No microphone found. Connect or select an input device and try again.';
      case 'NotReadableError':
        return 'The microphone is in use by another application.';
    }
  }
  return err instanceof Error ? err.message : 'Failed to start recording';
}
