import { describe, it, expect } from 'vitest';
import { PRIMARY_DESTINATIONS } from '@renderer/navigation';

describe('navigation/destinations', () => {
  it('lists Home, Journals, Tasks, Graph, Topics, Meetings as primary destinations', () => {
    expect(PRIMARY_DESTINATIONS.map((d) => d.id)).toEqual([
      'home',
      'journals',
      'tasks',
      'graph',
      'topics',
      'meetings',
    ]);
  });

  it('marks each destination active only when pathname matches exactly', () => {
    for (const destination of PRIMARY_DESTINATIONS) {
      expect(destination.isActive(destination.path)).toBe(true);
      expect(destination.isActive('/home/nested')).toBe(false);
    }
  });

  it('never marks a primary destination active while viewing a note', () => {
    for (const destination of PRIMARY_DESTINATIONS) {
      expect(destination.isActive('/note/abc123')).toBe(false);
    }
  });

  it('only one destination is active for any given primary pathname', () => {
    for (const destination of PRIMARY_DESTINATIONS) {
      const activeCount = PRIMARY_DESTINATIONS.filter((d) => d.isActive(destination.path)).length;
      expect(activeCount).toBe(1);
    }
  });

  it('is a frozen list so consumers cannot mutate destinations at runtime', () => {
    expect(Object.isFrozen(PRIMARY_DESTINATIONS)).toBe(true);
  });
});
