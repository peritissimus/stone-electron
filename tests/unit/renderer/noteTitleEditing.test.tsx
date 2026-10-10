/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@phosphor-icons/react', () =>
  Object.fromEntries(
    [
      'Star',
      'PushPin',
      'Archive',
      'DotsThreeVertical',
      'Check',
      'Trash',
      'FloppyDisk',
      'Export',
      'FilePdf',
      'FileHtml',
      'FileText',
      'Code',
      'TextAa',
      'CaretRight',
    ].map((name) => [name, () => <span />]),
  ),
);
vi.mock('@renderer/services/view-state/hooks/useUI', () => ({
  useEditorUI: () => ({ editorMode: 'rich', toggleEditorMode: vi.fn() }),
}));
vi.mock('@renderer/components/composites', () => ({
  IconButton: ({ onClick, tooltip }: { onClick?: () => void; tooltip: string }) => (
    <button onClick={onClick}>{tooltip}</button>
  ),
  sizeHeightClasses: { spacious: 'h-12' },
}));
import { NoteEditorHeader } from '@renderer/features/notes/views/editor/NoteEditorHeader';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('note title editing', () => {
  let root: Root;
  let container: HTMLDivElement;
  const save = vi.fn();

  beforeEach(() => {
    save.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <NoteEditorHeader
          title="Original"
          onTitleChange={save}
          isFavorite={false}
          isPinned={false}
          isArchived={false}
          onToggleFavorite={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleArchive={vi.fn()}
          onDelete={vi.fn()}
        />,
      ),
    );
    act(() => (container.querySelector('[title="Original"]') as HTMLButtonElement).click());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function enterTitle(value: string) {
    const input = container.querySelector('input')!;
    act(() => {
      input.value = value;
      Simulate.change(input, { target: input });
    });
    await act(async () => Simulate.keyDown(input, { key: 'Enter' }));
  }

  it.each(['   ', 'a'.repeat(256)])(
    'preserves invalid input and explains why it cannot save',
    async (value) => {
      await enterTitle(value);
      expect(save).not.toHaveBeenCalled();
      expect(container.querySelector('input')?.value).toBe(value);
      expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/cannot/);
    },
  );

  it('keeps the edit after a failed save and permits retry without losing the title', async () => {
    save.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await enterTitle('  Updated  ');
    expect(save).toHaveBeenCalledWith('Updated');
    expect(container.querySelector('input')?.value).toBe('  Updated  ');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    await act(async () => Simulate.keyDown(container.querySelector('input')!, { key: 'Enter' }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(container.querySelector('input')).toBeNull();
  });
});
