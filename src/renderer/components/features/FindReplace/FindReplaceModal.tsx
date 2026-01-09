/**
 * FindReplaceModal - Find and replace panel for the editor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { X, MagnifyingGlass, ArrowUp, ArrowDown, TextAa } from 'phosphor-react';
import type { Editor } from '@tiptap/react';

interface FindReplaceModalProps {
  editor: Editor | null;
}

export function FindReplaceModal({ editor }: FindReplaceModalProps) {
  const { findReplaceOpen, closeFindReplace } = useUIStore();
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
    [editor]
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
        className="relative w-full max-w-md mx-4 flex flex-col gap-3 rounded-xl border border-border bg-popover p-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Find & Replace</span>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Close (Escape)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`rounded-lg p-2 ${
              caseSensitive
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title="Case sensitive"
          >
            <TextAa size={18} weight={caseSensitive ? 'bold' : 'regular'} />
          </button>
          <button
            onClick={handleFindPrevious}
            disabled={matchCount === 0}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Previous (Shift+Enter)"
          >
            <ArrowUp size={18} />
          </button>
          <button
            onClick={handleFindNext}
            disabled={matchCount === 0}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Next (Enter)"
          >
            <ArrowDown size={18} />
          </button>
        </div>

        {/* Match Counter */}
        {searchTerm && (
          <div className="text-xs text-muted-foreground">
            {matchCount === 0 ? (
              'No results'
            ) : (
              <>
                {currentMatch} of {matchCount} matches
              </>
            )}
          </div>
        )}

        {/* Replace Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace with..."
            className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleReplace}
            disabled={matchCount === 0}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            title="Replace current (Cmd+Enter)"
          >
            Replace
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={matchCount === 0}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            title="Replace all (Cmd+Shift+Enter)"
          >
            All
          </button>
        </div>
      </div>
    </div>
  );
}

export default FindReplaceModal;
