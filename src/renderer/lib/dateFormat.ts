/**
 * Date formatting utilities
 */

/**
 * Today as `YYYY-MM-DD` in the reader's own calendar.
 *
 * Not `toISOString()`, which converts to UTC first and so names yesterday for
 * anyone west of Greenwich during their evening — journals and daily reviews
 * are keyed by local calendar date everywhere in the app.
 */
export function todayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date as a relative time string (e.g., "just now", "5 minutes ago")
 */
export function formatRelativeDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Get time-based greeting (Good morning/afternoon/evening)
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Extract folder path from file path
 */
export function getFolderPath(filePath: string | null): string | null {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  const lastSlash = normalizedPath.lastIndexOf('/');
  return lastSlash > 0 ? normalizedPath.substring(0, lastSlash) : null;
}
