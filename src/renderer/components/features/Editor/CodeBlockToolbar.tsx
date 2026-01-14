/**
 * Code Block Toolbar - Language selector and diagram toggle for code blocks
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, ArrowsOutSimple, DownloadSimple } from 'phosphor-react';
import { cn } from '@renderer/lib/utils';

/**
 * Supported programming languages for syntax highlighting
 */
export const CODE_LANGUAGES = [
  { value: '', label: 'auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'flowdsl', label: 'FlowDSL' },
] as const;

interface CodeBlockToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  isDiagram?: boolean;
  showCode?: boolean;
  onToggleView?: () => void;
  onFullscreen?: () => void;
  codeContent?: string;
  onDownload?: () => void;
}

export const CodeBlockToolbar: React.FC<CodeBlockToolbarProps> = ({
  language,
  onLanguageChange,
  isDiagram = false,
  showCode = false,
  onToggleView,
  onFullscreen,
  codeContent = '',
  onDownload,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!codeContent) return;

    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [codeContent]);

  return (
    <div className="code-block-toolbar absolute top-2 right-2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {/* Fullscreen button (only for diagrams in preview mode) */}
      {isDiagram && !showCode && onFullscreen && (
        <button
          type="button"
          contentEditable={false}
          onClick={onFullscreen}
          className={cn(
            'p-1.5 rounded bg-background/90 backdrop-blur-xs',
            'border border-border text-foreground cursor-pointer',
            'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
            'hover:bg-accent transition-colors',
          )}
          title="View fullscreen"
        >
          <ArrowsOutSimple size={14} />
        </button>
      )}

      {/* Diagram toggle button (Mermaid or FlowDSL) */}
      {isDiagram && onToggleView && (
        <button
          type="button"
          contentEditable={false}
          onClick={onToggleView}
          className={cn(
            'px-3 py-1 text-xs rounded bg-background/90 backdrop-blur-xs',
            'border border-border text-foreground cursor-pointer',
            'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
            'hover:bg-accent transition-colors',
            'font-medium',
          )}
        >
          {showCode ? 'View Diagram' : 'Edit Code'}
        </button>
      )}

      {/* Download as PNG */}
      {onDownload && (
        <button
          type="button"
          contentEditable={false}
          onClick={onDownload}
          className={cn(
            'p-1.5 rounded bg-background/90 backdrop-blur-xs',
            'border border-border text-foreground cursor-pointer',
            'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
            'hover:bg-accent transition-colors',
          )}
          title="Download as PNG"
        >
          <DownloadSimple size={14} />
        </button>
      )}

      {/* Copy button */}
      <button
        type="button"
        contentEditable={false}
        onClick={handleCopy}
        className={cn(
          'p-1.5 rounded bg-background/90 backdrop-blur-xs',
          'border border-border text-foreground cursor-pointer',
          'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
          'hover:bg-accent transition-colors',
          copied && 'text-green-600 dark:text-green-400',
        )}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      {/* Language selector dropdown */}
      <select
        contentEditable={false}
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className={cn(
          'px-2 py-1 text-xs rounded bg-background/90 backdrop-blur-xs',
          'border border-border text-foreground cursor-pointer',
          'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
          'hover:bg-accent transition-colors',
        )}
      >
        {CODE_LANGUAGES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};
