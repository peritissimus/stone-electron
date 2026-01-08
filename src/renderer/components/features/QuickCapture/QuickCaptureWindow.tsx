/**
 * QuickCaptureWindow - Floating window for quick journal capture
 */

import { useState, useRef, useEffect } from 'react';
import { useQuickCaptureAPI } from '@renderer/hooks/useQuickCaptureAPI';

const DRAFT_KEY = 'quick-capture-draft';

export function QuickCaptureWindow() {
  const [text, setText] = useState(() => {
    // Restore draft on mount
    return localStorage.getItem(DRAFT_KEY) || '';
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { appendToJournal, isSubmitting } = useQuickCaptureAPI();

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Save draft on text change
  useEffect(() => {
    if (text.trim()) {
      localStorage.setItem(DRAFT_KEY, text);
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [text]);

  const handleSubmit = async () => {
    const note = await appendToJournal(text);
    if (note) {
      // Clear draft on successful save
      localStorage.removeItem(DRAFT_KEY);
      window.close();
    }
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
        placeholder="What's on your mind?"
        disabled={isSubmitting}
        autoFocus
        rows={3}
        className="w-full h-full px-4 py-3 text-sm bg-background/80 backdrop-blur-xl rounded-xl border-none outline-none resize-none placeholder:text-xs placeholder:text-muted-foreground/30"
      />
    </div>
  );
}
