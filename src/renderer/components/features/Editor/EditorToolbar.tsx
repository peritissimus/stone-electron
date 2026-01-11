/**
 * Editor Toolbar Component
 *
 * Uses command factory pattern to reduce handler boilerplate.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@renderer/lib/utils';
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Code,
  HighlighterCircle,
  Image,
  Link,
  List,
  ListNumbers,
  Minus,
  Quotes,
  TextBolder,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  ArrowLineUp,
  ArrowLineDown,
  ArrowLineLeft,
  ArrowLineRight,
  Trash,
  Table as TableIcon,
} from 'phosphor-react';
import { ToolbarButton, ToolbarDivider } from '@renderer/components/composites';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/base/ui/popover';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';

export interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

/** Supported programming languages for code blocks */
const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid (Diagram)' },
  { value: 'plaintext', label: 'Plain Text' },
] as const;

/**
 * Hook that creates memoized editor command handlers.
 * Uses factory pattern to reduce boilerplate - single dependency array instead of 20+.
 */
function useEditorCommands(editor: Editor | null) {
  return useMemo(() => {
    // Factory for simple toggle commands
    const toggle = (command: string) => () => {
      (editor?.chain().focus() as any)[command]?.().run();
    };

    // Factory for commands with arguments
    const run = (command: string, args?: any) => () => {
      (editor?.chain().focus() as any)[command]?.(args).run();
    };

    return {
      // History
      undo: toggle('undo'),
      redo: toggle('redo'),

      // Text formatting
      toggleBold: toggle('toggleBold'),
      toggleItalic: toggle('toggleItalic'),
      toggleStrike: toggle('toggleStrike'),
      toggleCode: toggle('toggleCode'),
      toggleHighlight: toggle('toggleHighlight'),

      // Headings
      toggleH1: run('toggleHeading', { level: 1 }),
      toggleH2: run('toggleHeading', { level: 2 }),
      toggleH3: run('toggleHeading', { level: 3 }),

      // Lists
      toggleBulletList: toggle('toggleBulletList'),
      toggleOrderedList: toggle('toggleOrderedList'),

      // Blocks
      toggleBlockquote: toggle('toggleBlockquote'),
      setHorizontalRule: toggle('setHorizontalRule'),
      toggleCodeBlock: toggle('toggleCodeBlock'),

      // Table operations
      insertTable: run('insertTable', { rows: 3, cols: 3, withHeaderRow: true }),
      addRowBefore: toggle('addRowBefore'),
      addRowAfter: toggle('addRowAfter'),
      addColumnBefore: toggle('addColumnBefore'),
      addColumnAfter: toggle('addColumnAfter'),
      deleteRow: toggle('deleteRow'),
      deleteColumn: toggle('deleteColumn'),
    };
  }, [editor]);
}

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);

  // Get all editor commands from factory hook
  const cmd = useEditorCommands(editor);

  // Link handlers (need state access, can't use factory)
  const handleInsertLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setLinkPopoverOpen(false);
    }
  }, [editor, linkUrl]);

  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && linkUrl) {
        handleInsertLink();
      }
    },
    [handleInsertLink, linkUrl],
  );

  const handleCancelLink = useCallback(() => {
    setLinkUrl('');
    setLinkPopoverOpen(false);
  }, []);

  // Image handlers (need state access, can't use factory)
  const handleInsertImage = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImagePopoverOpen(false);
    }
  }, [editor, imageUrl]);

  const handleImageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && imageUrl) {
        handleInsertImage();
      }
    },
    [handleInsertImage, imageUrl],
  );

  const handleCancelImage = useCallback(() => {
    setImageUrl('');
    setImagePopoverOpen(false);
  }, []);

  if (!editor) return null;

  // Sync language selector with active code block
  useEffect(() => {
    if (!editor) return;

    const updateLanguage = () => {
      if (editor.isActive('codeBlock')) {
        const attrs = editor.getAttributes('codeBlock');
        const language = attrs.language || 'plaintext';
        setSelectedLanguage(language);
      }
    };

    // Update on selection change
    editor.on('selectionUpdate', updateLanguage);
    editor.on('update', updateLanguage);

    // Initial update
    updateLanguage();

    return () => {
      editor.off('selectionUpdate', updateLanguage);
      editor.off('update', updateLanguage);
    };
  }, [editor]);

  const handleCodeBlockInsert = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleCodeBlock().run();
    // Set the language attribute after creating the code block
    if (editor.isActive('codeBlock')) {
      editor.commands.updateAttributes('codeBlock', { language: selectedLanguage });
    }
  }, [editor, selectedLanguage]);

  const handleLanguageChange = useCallback(
    (language: string) => {
      setSelectedLanguage(language);
      // If currently in a code block, update its language
      if (editor?.isActive('codeBlock')) {
        editor.commands.updateAttributes('codeBlock', { language });
      }
    },
    [editor],
  );

  const isInTable = useMemo(
    () => editor.isActive('table') || editor.isActive('tableRow') || editor.isActive('tableCell'),
    [editor],
  );

  return (
    <div
      className={cn(
        'bg-background/95 backdrop-blur-xs px-3 py-2 flex items-center gap-1 flex-wrap border-b border-border/50',
        className,
      )}
    >
      {/* History Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={cmd.undo}
          disabled={!editor.can().undo()}
          tooltip="Undo (Ctrl+Z)"
        >
          <ArrowCounterClockwise size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.redo}
          disabled={!editor.can().redo()}
          tooltip="Redo (Ctrl+Y)"
        >
          <ArrowClockwise size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Text Formatting Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleBold}
          active={editor.isActive('bold')}
          tooltip="Bold (Ctrl+B)"
        >
          <TextBolder size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleItalic}
          active={editor.isActive('italic')}
          tooltip="Italic (Ctrl+I)"
        >
          <TextItalic size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleStrike}
          active={editor.isActive('strike')}
          tooltip="Strikethrough"
        >
          <TextStrikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleCode}
          active={editor.isActive('code')}
          tooltip="Inline Code"
        >
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleHighlight}
          active={editor.isActive('highlight')}
          tooltip="Highlight"
        >
          <HighlighterCircle size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Headings Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleH1}
          active={editor.isActive('heading', { level: 1 })}
          tooltip="Heading 1 (Ctrl+Alt+1)"
        >
          <TextHOne size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleH2}
          active={editor.isActive('heading', { level: 2 })}
          tooltip="Heading 2 (Ctrl+Alt+2)"
        >
          <TextHTwo size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleH3}
          active={editor.isActive('heading', { level: 3 })}
          tooltip="Heading 3 (Ctrl+Alt+3)"
        >
          <TextHThree size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Lists Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleBulletList}
          active={editor.isActive('bulletList')}
          tooltip="Bullet List"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleOrderedList}
          active={editor.isActive('orderedList')}
          tooltip="Numbered List"
        >
          <ListNumbers size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Blocks Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={cmd.toggleBlockquote}
          active={editor.isActive('blockquote')}
          tooltip="Blockquote"
        >
          <Quotes size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={handleCodeBlockInsert}
          active={editor.isActive('codeBlock')}
          tooltip="Code Block"
        >
          <Code size={14} />
        </ToolbarButton>
        {editor.isActive('codeBlock') && (
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-6 w-[110px] text-xs border-border/60 bg-background/50">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value} className="text-xs">
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ToolbarButton size="compact" onClick={cmd.setHorizontalRule} tooltip="Horizontal Rule">
          <Minus size={14} />
        </ToolbarButton>
      </div>

      {isInTable && (
        <>
          <ToolbarDivider size="sm" />
          <div className="flex items-center gap-0.5 mr-2">
            <ToolbarButton
              size="compact"
              onClick={cmd.addRowBefore}
              disabled={!editor.can().chain().focus().addRowBefore().run()}
              tooltip="Insert row above"
            >
              <ArrowLineUp size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={cmd.addRowAfter}
              disabled={!editor.can().chain().focus().addRowAfter().run()}
              tooltip="Insert row below"
            >
              <ArrowLineDown size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={cmd.addColumnBefore}
              disabled={!editor.can().chain().focus().addColumnBefore().run()}
              tooltip="Insert column before"
            >
              <ArrowLineLeft size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={cmd.addColumnAfter}
              disabled={!editor.can().chain().focus().addColumnAfter().run()}
              tooltip="Insert column after"
            >
              <ArrowLineRight size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={cmd.deleteRow}
              disabled={!editor.can().chain().focus().deleteRow().run()}
              tooltip="Delete row"
            >
              <Trash size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={cmd.deleteColumn}
              disabled={!editor.can().chain().focus().deleteColumn().run()}
              tooltip="Delete column"
            >
              <Trash size={14} />
            </ToolbarButton>
          </div>
        </>
      )}

      <ToolbarDivider />

      {/* Insert Group */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton size="compact" onClick={cmd.insertTable} tooltip="Insert Table (3x3)">
          <TableIcon size={14} />
        </ToolbarButton>
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <div>
              <ToolbarButton size="compact" active={editor.isActive('link')} tooltip="Insert Link">
                <Link size={14} />
              </ToolbarButton>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Insert Link</h4>
                <Input
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={handleLinkKeyDown}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelLink}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleInsertLink} disabled={!linkUrl}>
                  Insert
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
          <PopoverTrigger asChild>
            <div>
              <ToolbarButton size="compact" tooltip="Insert Image">
                <Image size={14} />
              </ToolbarButton>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Insert Image</h4>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={handleImageKeyDown}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelImage}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleInsertImage} disabled={!imageUrl}>
                  Insert
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
