/**
 * QuickCaptureWindow - Floating window for quick journal capture
 *
 * Optimized for speed: closes immediately on submit, save happens in background
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuickCaptureAPI } from '@renderer/hooks/useQuickCaptureAPI';

const DRAFT_KEY = 'quick-capture-draft';

export function QuickCaptureWindow() {
  const { appendToJournal } = useQuickCaptureAPI();
  const [text, setText] = useState(() => {
    // Restore draft on mount
    return localStorage.getItem(DRAFT_KEY) || '';
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus immediately
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Save draft on text change (debounced naturally by React state)
  useEffect(() => {
    if (text.trim()) {
      localStorage.setItem(DRAFT_KEY, text);
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [text]);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Clear draft and close immediately for snappy UX
    localStorage.removeItem(DRAFT_KEY);
    window.close();

    // Fire and forget - save happens in background
    appendToJournal(trimmedText).catch((err) => {
      // If save fails, restore draft so user doesn't lose content
      console.error('[QuickCapture] Save failed:', err);
      localStorage.setItem(DRAFT_KEY, trimmedText);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') window.close();
  };

  return (
    <div className="h-screen w-screen p-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind? (Cmd+Enter to save)"
        autoFocus
        rows={3}
        className="w-full h-full px-4 py-3 text-sm bg-background/80 backdrop-blur-xl rounded-xl border-none outline-none resize-none placeholder:text-xs placeholder:text-muted-foreground/30"
      />
    </div>
  );
}
