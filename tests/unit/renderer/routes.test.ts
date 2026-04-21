import { describe, it, expect } from 'vitest';
import { toHome, toTasks, toGraph, toTopics, toNote } from '@renderer/navigation';

describe('navigation/routes', () => {
  it('builds canonical destination paths', () => {
    expect(toHome()).toBe('/home');
    expect(toTasks()).toBe('/tasks');
    expect(toGraph()).toBe('/graph');
    expect(toTopics()).toBe('/topics');
  });

  it('builds note routes from an id', () => {
    expect(toNote('abc123')).toBe('/note/abc123');
    expect(toNote('note-with-dashes')).toBe('/note/note-with-dashes');
  });

  it('returns a stable string per call so callers can compare paths safely', () => {
    expect(toHome()).toEqual(toHome());
    expect(toNote('x')).toEqual(toNote('x'));
  });
});
