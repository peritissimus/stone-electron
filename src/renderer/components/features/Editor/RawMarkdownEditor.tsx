/**
 * Raw Markdown Editor Component
 * A plain text editor for editing raw markdown without formatting
 */

import React, { useCallback, useEffect, useRef, forwardRef } from 'react';
import { cn } from '@renderer/lib/utils';
import type { CursorPosition } from '@renderer/hooks/useDocumentBuffer';

export interface RawMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  initialCursorPosition?: CursorPosition;
  onCursorChange?: (position: CursorPosition) => void;
}

export interface RawMarkdownEditorHandle {
  focus: () => void;
  getCursorPosition: () => CursorPosition;
  setCursorPosition: (position: CursorPosition) => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

export const RawMarkdownEditor = forwardRef<HTMLDivElement, RawMarkdownEditorProps>(
  function RawMarkdownEditor({ value, onChange, className }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorPositionRef = useRef<number | null>(null);

    // Handle tab key for indentation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = e.currentTarget.selectionStart;
          const end = e.currentTarget.selectionEnd;

          // Insert 2 spaces at cursor position
          const newValue = value.substring(0, start) + '  ' + value.substring(end);
          cursorPositionRef.current = start + 2;
          onChange(newValue);
        }
      },
      [value, onChange],
    );

    // Restore cursor position after tab insertion
    useEffect(() => {
      if (cursorPositionRef.current !== null && textareaRef.current) {
        textareaRef.current.selectionStart = cursorPositionRef.current;
        textareaRef.current.selectionEnd = cursorPositionRef.current;
        cursorPositionRef.current = null;
      }
    });

    // Auto-resize textarea to fit content
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(textarea.scrollHeight, 300)}px`;
      }
    }, [value]);

    return (
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto bg-background">
        <div className="max-w-[900px] mx-auto px-16 py-12">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className={cn(
              'w-full min-h-[300px] resize-none',
              'bg-transparent border-none outline-none',
              'font-mono text-sm leading-relaxed',
              'text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none',
              className,
            )}
            placeholder="Write your markdown here..."
          />
        </div>
      </div>
    );
  },
);
