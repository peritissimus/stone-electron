import { useState, useRef, useMemo, useCallback } from 'react';
import { useModals } from '@renderer/hooks/useUI';
import { useCommandDefinitions } from './useCommandDefinitions';
import { useFilteredNotes } from './useFilteredNotes';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import type { CommandItem } from './types';

export type { CommandItem } from './types';

export function useCommandCenter() {
  const { commandCenterOpen } = useModals();

  const [query, setQueryState] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { commandItems, recentCommandCount, handleClose } = useCommandDefinitions(query);
  const noteItems = useFilteredNotes(query);

  const items = useMemo<CommandItem[]>(
    () => [...commandItems, ...noteItems],
    [commandItems, noteItems],
  );

  // Reset selection when the item list changes outside of a query change
  // (e.g. notes loading in asynchronously)
  const [prevItemsLength, setPrevItemsLength] = useState(items.length);
  if (items.length !== prevItemsLength) {
    setPrevItemsLength(items.length);
    setSelectedIndex(0);
  }

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setSelectedIndex(0);
  }, []);

  const handleOpen = useCallback(() => {
    setQueryState('');
    setSelectedIndex(0);
  }, []);

  useKeyboardNavigation({
    isOpen: commandCenterOpen,
    items,
    selectedIndex,
    setSelectedIndex,
    handleClose,
    listRef,
    inputRef,
    onOpen: handleOpen,
  });

  return {
    isOpen: commandCenterOpen,
    query,
    selectedIndex,
    items,
    noteItems,
    commandItems,
    recentCommandCount,
    inputRef,
    listRef,
    setQuery,
    setSelectedIndex,
    handleClose,
  };
}
