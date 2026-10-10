/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  useDocumentBuffer,
  useDocumentAutosave,
} from '@renderer/services/documents/hooks/useDocumentBuffer';
import { useDocumentBufferStore } from '@renderer/services/documents/model/documentBufferStore';

const updateNote = vi.hoisted(() => vi.fn());
vi.mock('@renderer/features/notes/commands/useNoteAPI', () => ({
  useNoteAPI: () => ({ updateNote }),
}));
vi.mock('@renderer/services/invalidation/hooks/useInvalidation', () => ({
  useInvalidation: () => {},
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let root: Root | undefined;
let editor: Editor | undefined;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  updateNote.mockReset().mockResolvedValue({ id: 'note-a' });
  useDocumentBufferStore.getState().clearAllBuffers();
  useDocumentBufferStore.getState().setBuffer('note-a', 'Original');
});
afterEach(() => {
  act(() => root?.unmount());
  editor?.destroy();
  root = undefined;
  editor = undefined;
  container?.remove();
  vi.useRealTimers();
});
function mount(element: React.ReactNode) {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root!.render(element));
}

describe('document buffer subscriptions', () => {
  it('refreshes Save UI only when dirty state changes without relying on editor rerenders', async () => {
    editor = new Editor({ extensions: [StarterKit] });
    let renders = 0;
    let buffer: ReturnType<typeof useDocumentBuffer>;
    function SaveControl() {
      renders += 1;
      buffer = useDocumentBuffer({ noteId: 'note-a', editor: editor! });
      return <button disabled={!buffer.isDirty}>Save</button>;
    }
    mount(<SaveControl />);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(container.querySelector('button')!.disabled).toBe(true);
    act(() => {
      editor!.commands.insertContent('First ');
    });
    expect(container.querySelector('button')!.disabled).toBe(false);
    const dirtyRenders = renders;
    act(() => {
      editor!.commands.insertContent('Second ');
    });
    expect(renders).toBe(dirtyRenders);
    await act(async () => {
      await buffer!.save();
    });
    expect(container.querySelector('button')!.disabled).toBe(true);
    expect(updateNote).toHaveBeenCalledWith(
      'note-a',
      { content: expect.stringContaining('Second') },
      false,
    );
  });

  it('debounces idle saves without rerendering the workbench and removes its subscription on unmount', async () => {
    let renders = 0;
    function WorkbenchProbe() {
      renders += 1;
      useDocumentAutosave();
      return null;
    }
    mount(<WorkbenchProbe />);
    act(() => useDocumentBufferStore.getState().updateBuffer('note-a', 'First edit'));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    act(() => useDocumentBufferStore.getState().updateBuffer('note-a', 'Latest edit'));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(updateNote).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(updateNote).toHaveBeenCalledExactlyOnceWith('note-a', { content: 'Latest edit' }, false);
    expect(useDocumentBufferStore.getState().isDirty('note-a')).toBe(false);
    expect(renders).toBe(1);
    act(() => root!.unmount());
    root = undefined;
    act(() => useDocumentBufferStore.getState().updateBuffer('note-a', 'After unmount'));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(updateNote).toHaveBeenCalledTimes(1);
  });

  it('saves edits made while a previous slow write is still in flight', async () => {
    let finishFirstWrite!: (value: { id: string }) => void;
    updateNote.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstWrite = resolve;
        }),
    );
    function WorkbenchProbe() {
      useDocumentAutosave();
      return null;
    }
    mount(<WorkbenchProbe />);
    act(() => useDocumentBufferStore.getState().updateBuffer('note-a', 'First version'));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    act(() => useDocumentBufferStore.getState().updateBuffer('note-a', 'Newer version'));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(updateNote).toHaveBeenCalledTimes(1);
    await act(async () => finishFirstWrite({ id: 'note-a' }));
    expect(useDocumentBufferStore.getState().isDirty('note-a')).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(updateNote).toHaveBeenLastCalledWith('note-a', { content: 'Newer version' }, false);
    expect(useDocumentBufferStore.getState().isDirty('note-a')).toBe(false);
  });
});
