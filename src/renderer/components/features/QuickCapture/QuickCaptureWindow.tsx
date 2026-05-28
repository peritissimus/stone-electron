/**
 * QuickCaptureWindow - Floating window for quick journal capture
 *
 * Optimized for speed: closes immediately on submit, save happens in background.
 * Mic button asks the main window to open the recording dock — saves the
 * typed text first if there is any, then hands off.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Microphone } from 'phosphor-react';
import { useQuickCaptureAPI } from '@renderer/hooks/useQuickCaptureAPI';
import { invokeIpc } from '@renderer/lib/ipc';
import { MEETING_CHANNELS } from '@shared/constants/ipcChannels';

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

  const handleStartRecording = async () => {
    // Save any typed text first so we don't lose it on the handoff.
    const trimmedText = text.trim();
    if (trimmedText) {
      localStorage.removeItem(DRAFT_KEY);
      appendToJournal(trimmedText).catch((err) => {
        console.error('[QuickCapture] Save failed during handoff:', err);
        localStorage.setItem(DRAFT_KEY, trimmedText);
      });
    }
    try {
      await invokeIpc(MEETING_CHANNELS.REQUEST_RECORDING, {});
    } catch (err) {
      console.error('[QuickCapture] Failed to request recording:', err);
    }
    window.close();
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
    <div className="relative h-screen w-screen p-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind? (Cmd+Enter to save)"
        autoFocus
        rows={3}
        className="w-full h-full px-4 py-3 pr-12 text-sm bg-background/80 backdrop-blur-xl rounded-xl border-none outline-none resize-none placeholder:text-xs placeholder:text-muted-foreground/30"
      />
      <button
        type="button"
        onClick={() => void handleStartRecording()}
        title="Start a meeting recording"
        aria-label="Start a meeting recording"
        className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-[transform,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
      >
        <Microphone size={14} weight="fill" />
      </button>
    </div>
  );
}
