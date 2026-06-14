import * as React from 'react';
import { Check, CaretDown } from '@phosphor-icons/react';

import { cn } from '@renderer/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** Placeholder shown in the trigger when empty. */
  placeholder?: string;
  /** Placeholder shown in the search/type field. */
  searchPlaceholder?: string;
  disabled?: boolean;
  /** When true (default), the typed text can be committed as a custom value. */
  allowCustom?: boolean;
  /** Extra classes for the trigger (e.g. width). */
  className?: string;
  /** Render values + options in a monospace font (model ids, URLs). */
  mono?: boolean;
}

/**
 * A styled combobox: pick from a dropdown of options or type a custom value.
 * Built on the app's Popover + Command primitives so it matches the design
 * system (unlike a native <datalist>).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search or type…',
  disabled,
  allowCustom = true,
  className,
  mono = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const commit = (next: string) => {
    onChange(next);
    setSearch('');
    setOpen(false);
  };

  const trimmed = search.trim();
  const showCustom = allowCustom && trimmed.length > 0 && !options.includes(trimmed);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm',
            'ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out',
            'hover:border-border focus:outline-hidden focus:ring-2 focus:ring-ring/40 focus:border-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span
            className={cn(
              'truncate',
              mono && 'font-mono text-xs',
              !value && 'text-muted-foreground',
            )}
          >
            {value || placeholder}
          </span>
          <CaretDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            className={cn(mono && 'font-mono text-xs')}
          />
          <CommandList>
            {!showCustom && <CommandEmpty>No matches.</CommandEmpty>}
            {showCustom && (
              <CommandGroup>
                <CommandItem
                  value={trimmed}
                  onSelect={() => commit(trimmed)}
                  className={cn(mono && 'font-mono text-xs')}
                >
                  Use “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => commit(option)}
                  className={cn(mono && 'font-mono text-xs')}
                >
                  <Check
                    className={cn('size-3.5', value === option ? 'opacity-100' : 'opacity-0')}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
