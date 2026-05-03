/**
 * @vitest-environment jsdom
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichTextEditor } from '@renderer/editor/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const editorDocument = vi.hoisted(() => ({
  getEditorMarkdown: vi.fn(),
  setEditorMarkdown: vi.fn(),
}));

const editorUI = vi.hoisted(() => ({
  editorMode: 'rich' as 'rich' | 'raw',
  setEditorMode: vi.fn((mode: 'rich' | 'raw') => {
    editorUI.editorMode = mode;
  }),
}));

vi.mock('@renderer/editor/document', () => editorDocument);
vi.mock('@renderer/hooks/useUI', () => ({
  useEditorUI: () => ({
    editorMode: editorUI.editorMode,
    setEditorMode: editorUI.setEditorMode,
  }),
}));

import { useEditorMode } from '@renderer/hooks/useEditorMode';

interface HookProps {
  editor: RichTextEditor | null;
  activeNoteId: string | null;
  isDirty: boolean;
  onSaveRaw: (markdown: string) => Promise<void>;
  onSaveRich: () => Promise<void>;
  onRawContentSaved?: (markdown: string) => void;
  onRawContentSynced?: (markdown: string, dirty: boolean) => void;
}

function renderUseEditorMode(initialProps: HookProps) {
  const container = document.createElement('div');
  let root: Root | null = createRoot(container);
  let props = initialProps;
  let current: ReturnType<typeof useEditorMode> | undefined;

  function Probe() {
    current = useEditorMode(props);
    return null;
  }

  const render = () => {
    if (!root) throw new Error('Hook is unmounted');
    root.render(createElement(Probe));
  };

  act(render);

  return {
    get current() {
      if (!current) throw new Error('Hook did not render');
      return current;
    },
    rerender(nextProps: Partial<HookProps> = {}) {
      props = { ...props, ...nextProps };
      act(render);
    },
    unmount() {
      if (!root) return;
      act(() => root?.unmount());
      root = null;
    },
  };
}

describe('useEditorMode', () => {
  const editor = {} as RichTextEditor;
  const onSaveRich = vi.fn();
  const onSaveRaw = vi.fn();
  const onRawContentSaved = vi.fn();
  const onRawContentSynced = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    editorUI.editorMode = 'rich';
    editorDocument.getEditorMarkdown.mockReturnValue('rich markdown');
    onSaveRaw.mockResolvedValue(undefined);
    onSaveRich.mockResolvedValue(undefined);
  });

  it('saves raw markdown back into the document buffer ownership callback', async () => {
    const hook = renderUseEditorMode({
      editor,
      activeNoteId: 'note-1',
      isDirty: false,
      onSaveRaw,
      onSaveRich,
      onRawContentSaved,
      onRawContentSynced,
    });

    editorUI.editorMode = 'raw';
    hook.rerender();
    expect(hook.current.rawMarkdown).toBe('rich markdown');

    act(() => hook.current.handleRawMarkdownChange('raw saved markdown'));
    expect(hook.current.rawDirty).toBe(true);

    await act(async () => {
      await hook.current.handleSave();
    });

    expect(onSaveRaw).toHaveBeenCalledWith('raw saved markdown');
    expect(onRawContentSaved).toHaveBeenCalledWith('raw saved markdown');
    expect(hook.current.rawDirty).toBe(false);

    editorUI.editorMode = 'rich';
    hook.rerender();

    expect(editorDocument.setEditorMarkdown).toHaveBeenCalledWith(editor, 'raw saved markdown');
    expect(onRawContentSynced).toHaveBeenCalledWith('raw saved markdown', false);
    hook.unmount();
  });

  it('marks raw content dirty when raw mode is forced back to rich without saving', async () => {
    const hook = renderUseEditorMode({
      editor,
      activeNoteId: 'note-1',
      isDirty: false,
      onSaveRaw,
      onSaveRich,
      onRawContentSaved,
      onRawContentSynced,
    });

    editorUI.editorMode = 'raw';
    hook.rerender();
    act(() => hook.current.handleRawMarkdownChange('unsaved raw markdown'));

    editorUI.editorMode = 'rich';
    hook.rerender();

    expect(editorDocument.setEditorMarkdown).toHaveBeenCalledWith(editor, 'unsaved raw markdown');
    expect(onRawContentSynced).toHaveBeenCalledWith('unsaved raw markdown', true);
    hook.unmount();
  });
});
