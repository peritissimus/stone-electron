/**
 * Search Panel Component
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useSearchAPI } from '@renderer/hooks/useSearchAPI';
import { MagnifyingGlass, X, Spinner, FileText } from 'phosphor-react';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { Body, Text } from '@renderer/components/base/ui/text';
import { ContainerFlex, ContainerStack } from '@renderer/components/base/ui';
import { logger } from '@renderer/utils/logger';

export function SearchPanel() {
  const { searchQuery, setSearchQuery, toggleSearch } = useUIStore();
  const { setActiveNote } = useNoteStore();
  const { fullTextSearch, loading } = useSearchAPI();

  const [results, setResults] = useState<any[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log mount/unmount
  useEffect(() => {
    logger.debug('[SearchPanel] Mounted (Cmd+K)');
    return () => logger.debug('[SearchPanel] Unmounted');
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        logger.debug('[SearchPanel] Closing via Escape key');
        toggleSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      searchTimeoutRef.current = null;
      const searchResults = await fullTextSearch(searchQuery, { limit: 20 });
      if (searchResults) {
        setResults(searchResults.results);
      }
    }, 300);
  }, [searchQuery, fullTextSearch]);

  const handleSelectNote = (noteId: string) => {
    logger.debug('[SearchPanel] Selected note:', noteId);
    setActiveNote(noteId);
    toggleSearch();
  };

  const handleClose = () => {
    logger.debug('[SearchPanel] Closing via X button');
    toggleSearch();
  };

  return (
    <div className="border-b border-border bg-card">
      {/* Search Input */}
      <ContainerFlex align="center" gap="md" className="p-4">
        <MagnifyingGlass size={18} className="text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="flex-1 h-8"
          autoFocus
        />
        {loading && <Spinner size={18} className="text-muted-foreground animate-spin" />}
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close search">
          <X size={18} />
        </Button>
      </ContainerFlex>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="max-h-96 overflow-y-auto border-t border-border">
          {results.length === 0 && !loading && (
            <div className="p-8 text-center">
              <Body size="sm" variant="muted">
                No results found for "{searchQuery}"
              </Body>
            </div>
          )}

          {results.map((result) => (
            <Button
              key={result.id}
              onClick={() => handleSelectNote(result.id)}
              variant="ghost"
              className="w-full justify-start p-4 rounded-none hover:bg-muted/50 border-b border-border h-auto"
            >
              <ContainerFlex align="start" gap="md">
                <FileText size={16} className="text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text weight="medium" as="div" className="mb-1 truncate">
                    {result.title || 'Untitled'}
                  </Text>
                  <Text size="sm" variant="muted" as="div" className="line-clamp-2">
                    {result.content_highlight || result.content?.substring(0, 150)}
                  </Text>
                  <Text size="xs" variant="muted" as="div" className="mt-2">
                    {formatDistanceToNow(new Date(result.updatedAt * 1000), { addSuffix: true })}
                  </Text>
                </div>
              </ContainerFlex>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
