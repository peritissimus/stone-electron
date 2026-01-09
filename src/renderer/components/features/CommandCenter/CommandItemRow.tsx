/**
 * Command Item Row - Individual item in the command center
 *
 * Implements: specs/components.ts#CommandItemRowProps
 */

import React from 'react';
import { ArrowRight } from 'phosphor-react';

export interface CommandItem {
  id: string;
  type: 'note' | 'command';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  score?: number;
  action: () => void;
}

export interface CommandItemRowProps {
  item: CommandItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function CommandItemRow({
  item,
  index,
  isSelected,
  onClick,
  onMouseEnter,
}: CommandItemRowProps) {
  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
    >
      <span
        className={`flex-shrink-0 ${isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}`}
      >
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div
            className={`text-xs truncate ${isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}
          >
            {item.subtitle}
          </div>
        )}
      </div>
      {item.shortcut && (
        <kbd
          className={`ml-auto px-1.5 py-0.5 rounded text-[11px] font-mono ${
            isSelected
              ? 'bg-accent-foreground/10 text-accent-foreground/80'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {item.shortcut}
        </kbd>
      )}
      {isSelected && !item.shortcut && (
        <ArrowRight size={14} className="flex-shrink-0 text-accent-foreground/50" />
      )}
    </button>
  );
}
