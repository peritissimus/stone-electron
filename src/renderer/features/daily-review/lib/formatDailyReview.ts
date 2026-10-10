/** Display helpers accept explicit clocks/locales so boundary cases stay deterministic. */
export function formatCount(count: number, locale?: string): string {
  return count.toLocaleString(locale);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainder}s`;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function formatRelative(value: Date | string, now = Date.now(), locale?: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown time';
  const delta = timestamp - now;
  const magnitude = Math.abs(delta);
  if (magnitude < 60_000) return delta > 0 ? 'in less than a minute' : 'just now';
  const unit = magnitude < 3_600_000 ? 'minute' : magnitude < 86_400_000 ? 'hour' : 'day';
  const divisor = unit === 'minute' ? 60_000 : unit === 'hour' ? 3_600_000 : 86_400_000;
  const amount = Math.floor(magnitude / divisor) * Math.sign(delta);
  return new Intl.RelativeTimeFormat(locale, { style: 'short' }).format(amount, unit);
}
