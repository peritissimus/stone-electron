import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatDuration,
  formatRelative,
} from '@renderer/features/daily-review/lib/formatDailyReview';

describe('Today display boundaries', () => {
  it('groups counts using the selected locale', () => {
    expect(formatCount(1284, 'en-US')).toBe('1,284');
    expect(formatCount(1284, 'de-DE')).toBe('1.284');
    expect(formatCount(0, 'en-US')).toBe('0');
  });

  it('rolls durations into hours without losing remaining minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59_999)).toBe('59s');
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(3_600_000)).toBe('1h 0m 0s');
    expect(formatDuration(48_249_000)).toBe('13h 24m 9s');
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
  });

  it('distinguishes future edits from recent past edits', () => {
    const now = Date.UTC(2026, 9, 11, 10);
    const label = (offset: number) => formatRelative(new Date(now + offset), now, 'en-US');
    expect(label(0)).toBe('just now');
    expect(label(-59_999)).toBe('just now');
    expect(label(1)).toBe('in less than a minute');
    expect(label(-60_000)).toBe('1 min. ago');
    expect(label(300_000)).toBe('in 5 min.');
    expect(label(3_600_000)).toBe('in 1 hr.');
    expect(label(-86_400_000)).toBe('1 day ago');
    expect(formatRelative('invalid', now, 'en-US')).toBe('Unknown time');
  });
});
