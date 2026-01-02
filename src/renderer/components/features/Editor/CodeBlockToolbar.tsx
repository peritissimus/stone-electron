/**
 * Code Block Toolbar - Language selector and diagram toggle for code blocks
 */

import React from 'react';
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
}

export const CodeBlockToolbar: React.FC<CodeBlockToolbarProps> = ({
  language,
  onLanguageChange,
  isDiagram = false,
  showCode = false,
  onToggleView,
}) => {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
            'font-medium'
          )}
        >
          {showCode ? 'View Diagram' : 'Edit Code'}
        </button>
      )}

      {/* Language selector dropdown */}
      <select
        contentEditable={false}
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className={cn(
          'px-2 py-1 text-xs rounded bg-background/90 backdrop-blur-xs',
          'border border-border text-foreground cursor-pointer',
          'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
          'hover:bg-accent transition-colors'
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
