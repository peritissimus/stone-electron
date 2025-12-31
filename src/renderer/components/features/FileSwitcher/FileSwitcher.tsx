/**
 * FileSwitcher - Cmd+P quick file navigation
 * Fast, focused file-only switcher with fuzzy search and recent files
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import { FileText, Clock, ArrowRight, Command } from 'phosphor-react';
import { logger } from '@renderer/utils/logger';

interface FileItem {
  id: string;
  title: string;
  filePath: string;
  score: number;
  isRecent: boolean;
  isBuffered: boolean;
}

/**
 * Simple fuzzy match scoring
 * Returns a score where higher = better match
 */
function fuzzyMatch(query: string, target: string): number {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (targetLower === queryLower) return 100;

  // Starts with query
  if (targetLower.startsWith(queryLower)) return 90;

  // Contains query as substring
  if (targetLower.includes(queryLower)) return 80;

  // Fuzzy match - all query chars appear in order
  let queryIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < targetLower.length && queryIdx < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      score += 10;
      // Bonus for consecutive matches
      score += consecutiveBonus;
      consecutiveBonus = Math.min(consecutiveBonus + 2, 10);
      queryIdx++;
    } else {
      consecutiveBonus = 0;
    }
  }

  // All query chars must be found
  if (queryIdx < queryLower.length) return 0;

  return score;
}

export function FileSwitcher() {
  const { fileSwitcherOpen, closeFileSwitcher } = useUIStore();
  const { notes, setActiveNote } = useNoteStore();
  const { hasBuffer } = useDocumentBufferStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get all available files with metadata
  const allFiles = useMemo<FileItem[]>(() => {
    return notes
      .filter((n) => !n.isDeleted && !n.isArchived)
      .map((note) => ({
        id: note.id,
        title: note.title || 'Untitled',
        filePath: note.filePath || '',
        score: 0,
        isRecent: false,
        isBuffered: hasBuffer(note.id),
      }))
      .sort((a, b) => {
        // Buffered files first (already loaded in memory)
        if (a.isBuffered !== b.isBuffered) return a.isBuffered ? -1 : 1;
        // Then by title
        return a.title.localeCompare(b.title);
      });
  }, [notes, hasBuffer]);

  // Recent files (top 8 most recently updated)
  const recentFiles = useMemo<FileItem[]>(() => {
    return notes
      .filter((n) => !n.isDeleted && !n.isArchived)
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : a.updatedAt;
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : b.updatedAt;
        return bTime - aTime;
      })
      .slice(0, 8)
      .map((note) => ({
        id: note.id,
        title: note.title || 'Untitled',
        filePath: note.filePath || '',
        score: 100,
        isRecent: true,
        isBuffered: hasBuffer(note.id),
      }));
  }, [notes, hasBuffer]);

  // Filter and sort files based on query
  const filteredFiles = useMemo<FileItem[]>(() => {
    if (!query.trim()) {
      return recentFiles;
    }

    const scored = allFiles
      .map((file) => {
        // Score both title and file path
        const titleScore = fuzzyMatch(query, file.title);
        const pathScore = fuzzyMatch(query, file.filePath) * 0.7; // Path matches weighted less
        return {
          ...file,
          score: Math.max(titleScore, pathScore),
        };
      })
      .filter((file) => file.score > 0)
      .sort((a, b) => {
        // Sort by score descending
        if (b.score !== a.score) return b.score - a.score;
        // Then buffered files first
        if (a.isBuffered !== b.isBuffered) return a.isBuffered ? -1 : 1;
        // Then by title
        return a.title.localeCompare(b.title);
      });

    return scored.slice(0, 20); // Limit results
  }, [query, allFiles, recentFiles]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles.length, query]);

  // Focus input when opened
  useEffect(() => {
    if (fileSwitcherOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [fileSwitcherOpen]);

  // Handle file selection
  const selectFile = useCallback(
    (file: FileItem) => {
      logger.debug('[FileSwitcher] Switching to file:', file.id, file.title);
      setActiveNote(file.id);
      closeFileSwitcher();
    },
    [setActiveNote, closeFileSwitcher]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!fileSwitcherOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeFileSwitcher();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            selectFile(filteredFiles[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileSwitcherOpen, closeFileSwitcher, filteredFiles, selectedIndex, selectFile]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!fileSwitcherOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/40 dark:bg-black/60 backdrop-blur-md"
        onClick={closeFileSwitcher}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-popover rounded-xl overflow-hidden border border-border shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3">
          <FileText size={20} weight="regular" className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search files..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <span className="text-xs text-muted-foreground">
              {filteredFiles.length} result{filteredFiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Results List */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
          {filteredFiles.length === 0 && query.length > 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">No files found for "{query}"</p>
            </div>
          )}

          {filteredFiles.length === 0 && !query && (
            <div className="px-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">No recent files</p>
            </div>
          )}

          {!query && filteredFiles.length > 0 && (
            <div className="px-4 py-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={10} />
                Recent Files
              </span>
            </div>
          )}

          {filteredFiles.map((file, idx) => (
            <FileItemRow
              key={file.id}
              file={file}
              index={idx}
              isSelected={selectedIndex === idx}
              onClick={() => selectFile(file)}
              onMouseEnter={() => setSelectedIndex(idx)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/50">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">esc</kbd>
              close
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Command size={10} />
            <span>P</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FileItemRowProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function FileItemRow({ file, index, isSelected, onClick, onMouseEnter }: FileItemRowProps) {
  // Extract folder path for display
  const folderPath = file.filePath.includes('/')
    ? file.filePath.substring(0, file.filePath.lastIndexOf('/'))
    : '';

  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'
      }`}
    >
      <span className={`flex-shrink-0 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
        <FileText size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
            {file.title}
          </span>
          {file.isBuffered && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-medium">
              Open
            </span>
          )}
        </div>
        {folderPath && (
          <div className={`text-xs truncate ${isSelected ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
            {folderPath}
          </div>
        )}
      </div>
      {isSelected && (
        <ArrowRight size={14} className="flex-shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
