/**
 * UrlInsertPopover - Reusable popover for inserting links and images
 */

import React, { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { ToolbarButton } from '@renderer/components/composites';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/base/ui/popover';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';

export interface UrlInsertPopoverProps {
  editor: Editor;
  type: 'link' | 'image';
  icon: React.ReactNode;
  tooltip: string;
}

export function UrlInsertPopover({ editor, type, icon, tooltip }: UrlInsertPopoverProps) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);

  const handleInsert = useCallback(() => {
    if (!url) return;

    if (type === 'link') {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().setImage({ src: url }).run();
    }

    setUrl('');
    setOpen(false);
  }, [editor, type, url]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && url) {
        handleInsert();
      }
    },
    [handleInsert, url],
  );

  const handleCancel = useCallback(() => {
    setUrl('');
    setOpen(false);
  }, []);

  const title = type === 'link' ? 'Insert Link' : 'Insert Image';
  const placeholder = type === 'link' ? 'https://example.com' : 'https://example.com/image.jpg';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <ToolbarButton
            size="compact"
            active={type === 'link' ? editor.isActive('link') : false}
            tooltip={tooltip}
          >
            {icon}
          </ToolbarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-2">{title}</h4>
            <Input
              placeholder={placeholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleInsert} disabled={!url}>
              Insert
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
