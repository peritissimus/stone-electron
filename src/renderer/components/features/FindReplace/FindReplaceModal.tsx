/**
 * FindReplaceModal - Find and replace panel for the editor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useModals } from '@renderer/hooks/useUI';
import { X, MagnifyingGlass, ArrowUp, ArrowDown, TextAa } from 'phosphor-react';
import type { Editor } from '@tiptap/react';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Toggle } from '@renderer/components/base/ui/toggle';
import { Text } from '@renderer/components/base/ui/text';
import { cn } from '@renderer/lib/utils';

interface FindReplaceModalProps {
  editor: Editor | null;
}

export function FindReplaceModal({ editor }: FindReplaceModalProps) {
  const { findReplaceOpen, closeFindReplace } = useModals();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (findReplaceOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [findReplaceOpen]);

  // Update search when term or case sensitivity changes
  useEffect(() => {
    if (!editor || !findReplaceOpen) return;

    editor.commands.setSearchTerm(searchTerm);

    // Get match info from storage
    const storage = editor.storage.searchAndReplace;
    if (storage) {
      setMatchCount(storage.results?.length || 0);
      setCurrentMatch(storage.results?.length > 0 ? storage.currentIndex + 1 : 0);
    }
  }, [editor, searchTerm, findReplaceOpen]);

  // Update case sensitivity
  useEffect(() => {
    if (!editor || !findReplaceOpen) return;
    editor.commands.setCaseSensitive(caseSensitive);

    const storage = editor.storage.searchAndReplace;
    if (storage) {
      setMatchCount(storage.results?.length || 0);
      setCurrentMatch(storage.results?.length > 0 ? storage.currentIndex + 1 : 0);
    }
  }, [editor, caseSensitive, findReplaceOpen]);

  // Update replace term
  useEffect(() => {
    if (!editor || !findReplaceOpen) return;
    editor.commands.setReplaceTerm(replaceTerm);
  }, [editor, replaceTerm, findReplaceOpen]);

  const handleClose = useCallback(() => {
    if (editor) {
      editor.commands.clearSearch();
    }
    closeFindReplace();
  }, [editor, closeFindReplace]);

  const handleFindNext = useCallback(() => {
    if (!editor) return;
    editor.commands.findNext();
    const storage = editor.storage.searchAndReplace;
    if (storage) {
      setCurrentMatch(storage.results?.length > 0 ? storage.currentIndex + 1 : 0);
    }
  }, [editor]);

  const handleFindPrevious = useCallback(() => {
    if (!editor) return;
    editor.commands.findPrevious();
    const storage = editor.storage.searchAndReplace;
    if (storage) {
      setCurrentMatch(storage.results?.length > 0 ? storage.currentIndex + 1 : 0);
    }
  }, [editor]);

  const handleReplace = useCallback(() => {
    if (!editor) return;
    editor.commands.replaceCurrent();
    const storage = editor.storage.searchAndReplace;
    if (storage) {
      setMatchCount(storage.results?.length || 0);
      setCurrentMatch(storage.results?.length > 0 ? storage.currentIndex + 1 : 0);
    }
  }, [editor]);

  const handleReplaceAll = useCallback(() => {
    if (!editor) return;
    editor.commands.replaceAll();
    setMatchCount(0);
    setCurrentMatch(0);
  }, [editor]);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/40 dark:bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md mx-4 flex flex-col gap-3 rounded-xl border border-border bg-popover p-4',
          'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Text as="span" className="text-sm font-medium text-foreground">
            Find & Replace
          </Text>
          <Button
            type="button"
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find..."
              className="h-9 pl-9 pr-3"
            />
          </div>
          <Toggle
            pressed={caseSensitive}
            onPressedChange={(pressed) => setCaseSensitive(pressed)}
            size="sm"
            className="rounded-lg"
            title="Case sensitive"
          >
            <TextAa size={18} weight={caseSensitive ? 'bold' : 'regular'} />
          </Toggle>
          <Button
            type="button"
            onClick={handleFindPrevious}
            disabled={matchCount === 0}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-muted-foreground"
            title="Previous (Shift+Enter)"
          >
            <ArrowUp size={18} />
          </Button>
          <Button
            type="button"
            onClick={handleFindNext}
            disabled={matchCount === 0}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-muted-foreground"
            title="Next (Enter)"
          >
            <ArrowDown size={18} />
          </Button>
        </div>

        {/* Match Counter */}
        {searchTerm && (
          <Text size="xs" variant="muted">
            {matchCount === 0 ? (
              'No results'
            ) : (
              <>
                {currentMatch} of {matchCount} matches
              </>
            )}
          </Text>
        )}

        {/* Replace Input */}
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace with..."
            className="h-9 flex-1"
          />
          <Button
            type="button"
            onClick={handleReplace}
            disabled={matchCount === 0}
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
            disabled={matchCount === 0}
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            title="Replace all (Cmd+Shift+Enter)"
          >
            All
          </Button>
        </div>
      </div>
    </div>
  );
}
