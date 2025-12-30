/**
 * Font Picker Component
 * Searchable dropdown for selecting system fonts
 */

import { useState, useEffect } from 'react';
import { Check, CaretDown } from 'phosphor-react';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/base/ui/button';
import { logger } from '@renderer/utils/logger';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/base/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/base/ui/popover';

interface FontPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function FontPicker({ value, onValueChange, placeholder = 'Select font...' }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFonts();
  }, []);

  const loadFonts = async () => {
    try {
      setLoading(true);
      const response = await window.electron.invoke<string[]>(SYSTEM_CHANNELS.GET_FONTS, {});
      if (response.success && response.data) {
        setFonts(response.data);
      }
    } catch (error) {
      logger.error('Failed to load fonts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract font family name from font stack
  const getDisplayName = (fontStack: string): string => {
    // Try to extract the first font name from the stack
    const match = fontStack.match(/^["']?([^,"']+)["']?/);
    return match ? match[1] : fontStack;
  };

  const selectedFont = getDisplayName(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10 px-3"
        >
          <span className="truncate text-sm" style={{ fontFamily: value }}>
            {selectedFont || placeholder}
          </span>
          <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command className="max-h-[400px]">
          <CommandInput placeholder="Search fonts..." className="h-10" />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {loading ? 'Loading fonts...' : 'No font found.'}
            </CommandEmpty>
            <CommandGroup>
              {fonts.map((font) => (
                <CommandItem
                  key={font}
                  value={font}
                  onSelect={() => {
                    onValueChange(font);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      value === font || selectedFont === font ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate text-sm" style={{ fontFamily: font }}>
                    {font}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
