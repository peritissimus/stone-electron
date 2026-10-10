/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@shared/types';
import { useFileTreeStore } from '@renderer/services/workspace/model/fileTreeStore';
import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';
import { useNoteByPath } from '@renderer/features/notes/hooks/useNotes';
import {
  useSidebarItemCursor,
  useSidebarCursor,
} from '@renderer/services/view-state/hooks/useSidebarCursor';
import { Sidebar } from '@renderer/workbench/panels/Sidebar';

const commands = vi.hoisted(() => ({
  navigate: vi.fn(),
  createNote: vi.fn(),
  loadNoteByPath: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  moveNote: vi.fn(),
  loadFileTree: vi.fn(),
  moveFolder: vi.fn(),
}));
vi.mock('@renderer/services/navigation', () => ({
  useNavigateToNote: () => commands.navigate,
  useActiveNoteId: () => 'a',
}));
vi.mock('@renderer/features/notes/commands/useNoteAPI', () => ({ useNoteAPI: () => commands }));
vi.mock('@renderer/services/workspace/commands/useFileTreeAPI', () => ({
  useFileTreeAPI: () => commands,
}));
vi.mock('@renderer/workbench/panels/SidebarNavList', () => ({
  SidebarNavList: () => <button>Today</button>,
}));
vi.mock('@renderer/workbench/panels/SidebarStatusRail', () => ({ SidebarStatusRail: () => null }));
vi.mock('@renderer/workbench/editor-group/viewRegistry', () => ({
  prefetchWorkbenchView: () => {},
}));
vi.mock('@renderer/components/composites', async () => {
  const { forwardRef } = await import('react');
  return {
    InputModal: () => null,
    IconButton: forwardRef<
      HTMLButtonElement,
      React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
    >(({ label, ...props }, ref) => <button ref={ref} {...props} aria-label={label} />),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let root: Root | undefined;
let container: HTMLDivElement;
const notes = [
  { id: 'a', title: 'Alpha', filePath: 'Inbox/Alpha.md' },
  { id: 'b', title: 'Beta', filePath: 'Beta.md' },
] as Note[];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  useSidebarFocusStore.setState({ cursorPath: null, pendingFocus: false });
  useNoteStore.getState().setNotes(notes);
  useFileTreeStore.setState({
    tree: [
      {
        name: 'Inbox',
        path: 'Inbox',
        type: 'folder',
        children: [{ name: 'Alpha.md', path: 'Inbox/Alpha.md', type: 'file' }],
      },
      { name: 'Beta.md', path: 'Beta.md', type: 'file' },
    ],
    expandedPaths: new Set(),
  });
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container?.remove();
});
function mount(element: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
}
function press(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}
function activeItem(tree: HTMLElement) {
  return document.getElementById(tree.getAttribute('aria-activedescendant') ?? '');
}

describe('sidebar tree accessibility', () => {
  it('announces the focused item, expansion and selection while supporting standard navigation', () => {
    mount(<Sidebar />);
    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    expect(tree.tabIndex).toBe(0);
    act(() => tree.focus());
    expect(activeItem(tree)?.getAttribute('aria-expanded')).toBe('false');

    press(tree, 'ArrowRight');
    const folder = activeItem(tree)!;
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    expect(folder.querySelector('[role="group"] [role="treeitem"]')).not.toBeNull();
    press(tree, 'ArrowDown');
    expect(document.activeElement).toBe(tree);
    expect(activeItem(tree)?.getAttribute('aria-selected')).toBe('true');
    expect(activeItem(tree)?.getAttribute('aria-level')).toBe('2');
    expect(commands.navigate).toHaveBeenLastCalledWith('a');

    press(tree, 'End');
    expect(commands.navigate).toHaveBeenLastCalledWith('b');
    expect(activeItem(tree)?.getAttribute('aria-level')).toBe('1');
    press(tree, 'Home');
    expect(activeItem(tree)).toBe(folder);
    press(tree, 'ArrowLeft');
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    expect(folder.querySelector('[role="group"]')).toBeNull();
  });

  it('restores a visible active descendant after external collapse and leaves action-button keys alone', () => {
    mount(<Sidebar />);
    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    act(() => {
      useFileTreeStore.getState().toggleExpanded('Inbox');
      useSidebarFocusStore.getState().requestFocus('Inbox/Alpha.md');
    });
    expect(document.activeElement).toBe(tree);
    expect(activeItem(tree)?.getAttribute('aria-selected')).toBe('true');
    act(() => useFileTreeStore.getState().toggleExpanded('Inbox'));
    expect(activeItem(tree)?.getAttribute('aria-expanded')).toBe('false');
    expect(useSidebarFocusStore.getState().cursorPath).toBe('Inbox');

    const action = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Create note in Inbox"]',
    )!;
    act(() => action.focus());
    press(action, 'ArrowDown');
    expect(useSidebarFocusStore.getState().cursorPath).toBe('Inbox');
    expect(commands.navigate).not.toHaveBeenCalled();
  });
});

describe('file row subscriptions', () => {
  it('does not rerender unrelated rows when a note is saved or the cursor moves', () => {
    const renders = { a: 0, b: 0 };
    let shellRenders = 0;
    function ShellActions() {
      useSidebarCursor();
      shellRenders += 1;
      return null;
    }
    function Row({ id, path }: { id: 'a' | 'b'; path: string }) {
      const note = useNoteByPath(path);
      const { isCursor } = useSidebarItemCursor(path);
      renders[id] += 1;
      return <span data-cursor={isCursor}>{note?.title}</span>;
    }
    mount(
      <>
        <ShellActions />
        <Row id="a" path="Inbox/Alpha.md" />
        <Row id="b" path="Beta.md" />
      </>,
    );
    expect(renders).toEqual({ a: 1, b: 1 });
    act(() => useNoteStore.getState().updateNote({ ...notes[0], title: 'Alpha saved' }));
    expect(renders).toEqual({ a: 2, b: 1 });
    expect(container.textContent).toContain('Alpha saved');
    act(() => useSidebarFocusStore.getState().setCursor('Inbox/Alpha.md'));
    expect(renders).toEqual({ a: 3, b: 1 });
    act(() => useSidebarFocusStore.getState().setCursor('Beta.md'));
    expect(renders).toEqual({ a: 4, b: 2 });
    expect(shellRenders).toBe(1);
  });
});
