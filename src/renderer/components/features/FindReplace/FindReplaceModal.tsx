/**
 * FindReplaceModal - Find and replace panel for the editor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useModals } from '@renderer/hooks/useUI';
import { X, MagnifyingGlass, ArrowUp, ArrowDown, TextAa } from '@phosphor-icons/react';
import type { RichTextEditor } from '@renderer/editor';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Toggle } from '@renderer/components/base/ui/toggle';
import { Text } from '@renderer/components/base/ui/text';
import { cn } from '@renderer/lib/utils';

interface FindReplaceModalProps {
  editor: RichTextEditor | null;
}

export function FindReplaceModal({ editor }: FindReplaceModalProps) {
  const { findReplaceOpen, closeFindReplace } = useModals();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchInfo, setMatchInfo] = useState({ count: 0, current: 0 });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateMatchInfo = useCallback((activeEditor: RichTextEditor) => {
    const storage = activeEditor.storage.searchAndReplace;
    if (!storage) return;
    const count = storage.results?.length || 0;
    setMatchInfo({ count, current: count > 0 ? storage.currentIndex + 1 : 0 });
  }, []);

  // Re-apply search state to the editor when the panel opens or the editor
  // instance changes. Per-keystroke updates happen in the change handlers, so
  // this intentionally only re-runs on those two deps.
  useEffect(() => {
    if (!editor || !findReplaceOpen) return;
    editor.commands.setSearchTerm(searchTerm);
    editor.commands.setCaseSensitive(caseSensitive);
    editor.commands.setReplaceTerm(replaceTerm);
    updateMatchInfo(editor);
  }, [editor, findReplaceOpen, updateMatchInfo]);

  const handleSearchTermChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      if (!editor) return;
      editor.commands.setSearchTerm(term);
      updateMatchInfo(editor);
    },
    [editor, updateMatchInfo],
  );

  const handleCaseSensitiveChange = useCallback(
    (pressed: boolean) => {
      setCaseSensitive(pressed);
      if (!editor) return;
      editor.commands.setCaseSensitive(pressed);
      updateMatchInfo(editor);
    },
    [editor, updateMatchInfo],
  );

  const handleReplaceTermChange = useCallback(
    (term: string) => {
      setReplaceTerm(term);
      if (!editor) return;
      editor.commands.setReplaceTerm(term);
    },
    [editor],
  );

  const handleClose = useCallback(() => {
    if (editor) {
      editor.commands.clearSearch();
    }
    closeFindReplace();
  }, [editor, closeFindReplace]);

  const handleFindNext = useCallback(() => {
    if (!editor) return;
    editor.commands.findNext();
    updateMatchInfo(editor);
  }, [editor, updateMatchInfo]);

  const handleFindPrevious = useCallback(() => {
    if (!editor) return;
    editor.commands.findPrevious();
    updateMatchInfo(editor);
  }, [editor, updateMatchInfo]);

  const handleReplace = useCallback(() => {
    if (!editor) return;
    editor.commands.replaceCurrent();
    updateMatchInfo(editor);
  }, [editor, updateMatchInfo]);

  const handleReplaceAll = useCallback(() => {
    if (!editor) return;
    editor.commands.replaceAll();
    setMatchInfo({ count: 0, current: 0 });
  }, [editor]);

  // Focus search input when modal opens (instead of Radix's default autofocus)
  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleClose();
    },
    [handleClose],
  );

  // Keyboard handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        handleReplaceAll();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleReplace();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleFindNext();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleFindPrevious();
      }
    },
    [handleClose, handleFindNext, handleFindPrevious, handleReplace, handleReplaceAll],
  );

  if (!findReplaceOpen) return null;

  return (
    <DialogPrimitive.Root open={findReplaceOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 dark:bg-black/60 backdrop-blur-md" />

        {/* Modal */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={handleOpenAutoFocus}
          className={cn(
            'fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex flex-col gap-3 rounded-xl border border-border bg-popover p-4',
            'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-sm font-medium text-foreground">
              Find & Replace
            </DialogPrimitive.Title>
            <Button
              type="button"
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="size-8"
              title="Close (Escape)"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                placeholder="Find..."
                className="h-9 pl-9 pr-3"
              />
            </div>
            <Toggle
              pressed={caseSensitive}
              onPressedChange={handleCaseSensitiveChange}
              size="sm"
              className="rounded-lg"
              title="Case sensitive"
            >
              <TextAa size={18} weight={caseSensitive ? 'bold' : 'regular'} />
            </Toggle>
            <Button
              type="button"
              onClick={handleFindPrevious}
              disabled={matchInfo.count === 0}
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg text-muted-foreground"
              title="Previous (Shift+Enter)"
            >
              <ArrowUp size={18} />
            </Button>
            <Button
              type="button"
              onClick={handleFindNext}
              disabled={matchInfo.count === 0}
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg text-muted-foreground"
              title="Next (Enter)"
            >
              <ArrowDown size={18} />
            </Button>
          </div>

          {/* Match Counter */}
          {searchTerm && (
            <Text size="xs" variant="muted">
              {matchInfo.count === 0 ? (
                'No results'
              ) : (
                <>
                  {matchInfo.current} of {matchInfo.count} matches
                </>
              )}
            </Text>
          )}

          {/* Replace Input */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={replaceTerm}
              onChange={(e) => handleReplaceTermChange(e.target.value)}
              placeholder="Replace with..."
              className="h-9 flex-1"
            />
            <Button
              type="button"
              onClick={handleReplace}
              disabled={matchInfo.count === 0}
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              title="Replace current (Cmd+Enter)"
            >
              Replace
            </Button>
            <Button
              type="button"
              onClick={handleReplaceAll}
              disabled={matchInfo.count === 0}
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              title="Replace all (Cmd+Shift+Enter)"
            >
              All
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
