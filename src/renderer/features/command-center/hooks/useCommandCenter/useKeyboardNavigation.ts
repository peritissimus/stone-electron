import { useEffect, type RefObject } from 'react';
import type { CommandItem } from './types';

interface Options {
  isOpen: boolean;
  items: CommandItem[];
  selectedIndex: number;
  setSelectedIndex: (updater: (prev: number) => number) => void;
  handleClose: () => void;
  listRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  onOpen: () => void;
}

export function useKeyboardNavigation({
  isOpen,
  items,
  selectedIndex,
  setSelectedIndex,
  handleClose,
  listRef,
  inputRef,
  onOpen,
}: Options) {
  useEffect(() => {
    if (isOpen) {
      onOpen();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, onOpen, inputRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            items[selectedIndex].action();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, items, selectedIndex, setSelectedIndex]);

  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, listRef]);
}
