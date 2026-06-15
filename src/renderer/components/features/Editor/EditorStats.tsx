/**
 * Editor Stats Component - Shows word count, character count, and reading time
 */
import { useEffect, useState } from 'react';
import type { RichTextEditor } from '@renderer/editor';

export interface EditorStatsProps {
  editor: RichTextEditor | null;
}

interface Stats {
  words: number;
  characters: number;
  readingTime: string;
}

function computeStats(editor: RichTextEditor | null): Stats {
  if (!editor) {
    return { words: 0, characters: 0, readingTime: '0 min' };
  }

  const text = editor.getText();
  const characters = text.length;

  // Count words (split by whitespace and filter empty strings)
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  // Calculate reading time (average 200 words per minute)
  const minutes = Math.ceil(words / 200);
  const readingTime = minutes === 0 ? '< 1 min' : `${minutes} min`;

  return { words, characters, readingTime };
}

export function EditorStats({ editor }: EditorStatsProps) {
  // The editor is a mutable instance — subscribe to its 'update' events for
  // live stats instead of memoizing against it (deps would go stale).
  const [stats, setStats] = useState<Stats>(() => computeStats(editor));

  useEffect(() => {
    const update = () => setStats(computeStats(editor));
    update();
    if (!editor) return;
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{stats.words.toLocaleString()}</span>
        <span>words</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{stats.characters.toLocaleString()}</span>
        <span>characters</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{stats.readingTime}</span>
        <span>read</span>
      </div>
    </div>
  );
}
