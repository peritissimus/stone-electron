import { describe, expect, it } from 'vitest';
import { getTreeWindow } from '@renderer/services/workspace/hooks/useVirtualFileTree';

describe('file-tree window', () => {
  it('mounts a bounded window for a large collection and reaches the last row', () => {
    const top = getTreeWindow(1284, 34, -36, 600);
    const middle = getTreeWindow(1284, 34, 17000, 600);
    const bottom = getTreeWindow(1284, 34, 1284 * 34 - 600, 600);

    expect(top[0]).toBe(0);
    expect(top.length).toBeLessThan(32);
    expect(middle).toContain(500);
    expect(middle.length).toBeLessThan(32);
    expect(bottom.at(-1)).toBe(1283);
    expect(bottom.length).toBeLessThan(32);
  });

  it('keeps offscreen interaction targets mounted without filling the intervening rows', () => {
    const window = getTreeWindow(1284, 34, 17000, 600, [0, 0, 1283, -1, 1284]);
    expect(window[0]).toBe(0);
    expect(window.at(-1)).toBe(1283);
    expect(window).toContain(500);
    expect(window.length).toBeLessThan(34);
    expect(new Set(window).size).toBe(window.length);
  });

  it('uses measured row size after text scaling', () => {
    const normal = getTreeWindow(1284, 34, 17000, 600);
    const largeText = getTreeWindow(1284, 66, 17000, 600);
    expect(normal).toContain(500);
    expect(largeText).toContain(257);
    expect(largeText).not.toContain(500);
    expect(largeText.length).toBeLessThan(normal.length);
  });

  it('handles a collection collapsing while the old scroll offset is still present', () => {
    expect(getTreeWindow(0, 34, 40000, 600)).toEqual([]);
    expect(getTreeWindow(1, 34, 40000, 600)).toEqual([0]);
    expect(getTreeWindow(3, 34, 40000, 600)).toEqual([0, 1, 2]);
  });
});
