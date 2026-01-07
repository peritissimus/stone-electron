/**
 * QuickCaptureWindow - Floating window for quick journal capture
 */

import { useState, useRef, useEffect } from 'react';

export function QuickCaptureWindow() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await window.electron.invoke('quickCapture:appendToJournal', {
        text: text.trim(),
      });
      if (response.success) window.close();
    } catch {
      setIsSubmitting(false);
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
    <div className="h-screen w-screen flex items-center justify-center p-4 bg-transparent">
      <div className="w-full max-w-lg bg-background/90 backdrop-blur-2xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          disabled={isSubmitting}
          autoFocus
          rows={3}
          className="w-full px-5 py-4 text-base bg-transparent border-none outline-none resize-none placeholder:text-sm placeholder:text-muted-foreground/40"
        />
      </div>
    </div>
  );
}
