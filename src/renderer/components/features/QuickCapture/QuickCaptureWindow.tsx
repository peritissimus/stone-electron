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
