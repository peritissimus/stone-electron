/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setEditorMarkdown } from '@renderer/features/notes/editor/document';
import { EditorStats } from '@renderer/features/notes/views/editor/EditorStats';
import { useRichTextEditor } from '@renderer/features/notes/editor/tiptap/useTiptapEditor';

vi.mock('@renderer/features/notes/hooks/useNoteCache', () => ({
  useNoteCache: () => ({ fetchNotesForAutocomplete: async () => [] }),
}));
vi.mock('@renderer/features/notes/editor/config/codeLanguages', () => ({
  preloadConfiguredLanguages: async () => {},
  loadLanguage: async () => {},
}));
vi.mock('@renderer/features/notes/editor/config/buildExtensions', async () => {
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { CodeBlockWithMermaid } =
    await import('@renderer/features/notes/editor/extensions/CodeBlockWithMermaid');
  const { lowlight } = await import('lowlight');
  return {
    buildEditorExtensions: () => [
      StarterKit.configure({ codeBlock: false, trailingNode: false }),
      CodeBlockWithMermaid.configure({ lowlight }),
    ],
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;
let editor: Editor | null = null;
let container: HTMLDivElement;

afterEach(() => {
  act(() => root?.unmount());
  editor?.destroy();
  root = undefined;
  editor = null;
  container?.remove();
  vi.restoreAllMocks();
});

function mount(element: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
}

describe('editor transaction subscriptions', () => {
  it('updates stats once per edit, including silent hydration, without scanning selection changes', () => {
    editor = new Editor({ extensions: [StarterKit], content: '<p>Before</p>' });
    const getText = vi.spyOn(editor, 'getText');
    const onEdit = vi.fn();
    editor.on('update', onEdit);
    mount(<EditorStats editor={editor} />);
    getText.mockClear();

    act(() => {
      setEditorMarkdown(editor!, 'Two words');
    });
    expect(container.textContent).toContain('2words');
    expect(getText).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    getText.mockClear();

    act(() => {
      editor!.commands.setTextSelection(1);
      editor!.commands.insertContent('Another ');
    });
    expect(container.textContent).toContain('3words');
    expect(getText).toHaveBeenCalledTimes(1);
    getText.mockClear();

    act(() => {
      editor!.commands.setTextSelection(2);
    });
    expect(getText).not.toHaveBeenCalled();
  });

  it('keeps editor chrome out of transaction renders while code block controls stay current', async () => {
    let chromeRenders = 0;
    function Chrome() {
      chromeRenders += 1;
      editor = useRichTextEditor();
      return <EditorContent editor={editor} />;
    }
    mount(<Chrome />);
    expect(editor).not.toBeNull();
    const initialRenders = chromeRenders;

    await act(async () => {
      editor!.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: '{"a":1}' }],
          },
        ],
      });
    });
    expect(container.querySelector('select')?.value).toBe('javascript');
    expect(chromeRenders).toBe(initialRenders);

    await act(async () => {
      editor!.commands.setTextSelection(2);
      editor!.commands.updateAttributes('codeBlock', { language: 'json' });
    });
    expect(container.querySelector('select')?.value).toBe('json');
    expect(container.querySelector('button[title="Format JSON"]')).not.toBeNull();
    expect(chromeRenders).toBe(initialRenders);
  });
});
