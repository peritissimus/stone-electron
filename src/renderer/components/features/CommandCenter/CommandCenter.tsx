/**
 * CommandCenter - Cmd+K command palette for quick navigation and actions
 *
 * Performance optimizations:
 * - In-memory filtering for instant results (no API calls)
 * - Fuzzy matching for typo-tolerant search
 * - Memoized commands and stable callbacks
 */

import { MagnifyingGlass, Command } from 'phosphor-react';
import { useCommandCenter } from '@renderer/hooks/useCommandCenter';
import { CommandItemRow } from './CommandItemRow';

export function CommandCenter() {
  const {
    isOpen,
    query,
    selectedIndex,
    noteItems,
    commandItems,
    inputRef,
    listRef,
    setQuery,
    setSelectedIndex,
    handleClose,
  } = useCommandCenter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-popover rounded-xl overflow-hidden border border-border shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3">
          <MagnifyingGlass
            size={20}
            weight="regular"
            className="text-muted-foreground flex-shrink-0"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes and commands..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1.5">
          {noteItems.length === 0 && commandItems.length === 0 && query.length >= 2 && (
            <div className="px-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">No results for "{query}"</p>
            </div>
          )}

          {/* Notes Section */}
          {noteItems.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {query.length > 0 ? 'Notes' : 'Recent'}
                </span>
              </div>
              {noteItems.map((item, idx) => (
                <CommandItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isSelected={selectedIndex === idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              ))}
            </>
          )}

          {/* Commands Section */}
          {commandItems.length > 0 && (
            <>
              <div className="px-4 py-1.5 mt-1">
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Commands
                </span>
              </div>
              {commandItems.map((item, idx) => {
                const actualIndex = noteItems.length + idx;
                return (
                  <CommandItemRow
                    key={item.id}
                    item={item}
                    index={actualIndex}
                    isSelected={selectedIndex === actualIndex}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(actualIndex)}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd>
              <span>open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">esc</kbd>
              <span>close</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
            <Command size={11} />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
