import { describe, it, expect } from 'vitest';
import { flattenVisibleTree } from '@renderer/hooks/useVisibleTreeItems';
import type { FileTreeNode } from '@renderer/stores/fileTreeStore';

function folder(path: string, children: FileTreeNode[] = []): FileTreeNode {
  const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
  return { name, path, type: 'folder', children };
}

function file(path: string): FileTreeNode {
  const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
  return { name, path, type: 'file' };
}

describe('flattenVisibleTree', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenVisibleTree([], new Set())).toEqual([]);
  });

  it('emits folders and files in pre-order when everything is expanded', () => {
    const tree: FileTreeNode[] = [
      folder('Journal', [file('Journal/2026-04-22.md')]),
      folder('Work', [file('Work/meeting.md'), file('Work/todo.md')]),
      file('readme.md'),
    ];
    const expanded = new Set(['Journal', 'Work']);

    const result = flattenVisibleTree(tree, expanded);

    expect(result.map((i) => i.path)).toEqual([
      'Journal',
      'Journal/2026-04-22.md',
      'Work',
      'Work/meeting.md',
      'Work/todo.md',
      'readme.md',
    ]);
  });

  it('hides children of collapsed folders', () => {
    const tree: FileTreeNode[] = [
      folder('Journal', [file('Journal/2026-04-22.md')]),
      folder('Work', [file('Work/meeting.md')]),
    ];
    // Only Journal expanded
    const result = flattenVisibleTree(tree, new Set(['Journal']));

    expect(result.map((i) => i.path)).toEqual([
      'Journal',
      'Journal/2026-04-22.md',
      'Work',
    ]);
  });

  it('tags each item with its parent folder path, using null for root items', () => {
    const tree: FileTreeNode[] = [
      folder('Work', [file('Work/meeting.md'), folder('Work/Q2', [file('Work/Q2/plan.md')])]),
      file('readme.md'),
    ];
    const result = flattenVisibleTree(tree, new Set(['Work', 'Work/Q2']));

    const byPath = Object.fromEntries(result.map((i) => [i.path, i.parentPath]));
    expect(byPath['Work']).toBe(null);
    expect(byPath['Work/meeting.md']).toBe('Work');
    expect(byPath['Work/Q2']).toBe('Work');
    expect(byPath['Work/Q2/plan.md']).toBe('Work/Q2');
    expect(byPath['readme.md']).toBe(null);
  });

  it('reports isExpanded correctly per folder', () => {
    const tree: FileTreeNode[] = [folder('A', [file('A/x.md')]), folder('B')];
    const result = flattenVisibleTree(tree, new Set(['A']));

    const folderA = result.find((i) => i.path === 'A');
    const folderB = result.find((i) => i.path === 'B');
    expect(folderA?.isExpanded).toBe(true);
    expect(folderB?.isExpanded).toBe(false);
  });
});
