/**
 * Code Block Component - Enhanced code block with Mermaid diagram rendering
 * Automatically detects "mermaid" language and renders diagrams like Notion/GitHub
 */

import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import mermaid from 'mermaid';
import { cn } from '@renderer/lib/utils';

// Initialize Mermaid with custom theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: 'hsl(211, 100%, 50%)',
    primaryTextColor: '#fff',
    primaryBorderColor: 'hsl(211, 100%, 45%)',
    lineColor: 'hsl(0, 0%, 60%)',
    secondaryColor: 'hsl(0, 0%, 95%)',
    tertiaryColor: 'hsl(0, 0%, 98%)',
    background: '#fff',
    mainBkg: 'hsl(0, 0%, 98%)',
    secondBkg: 'hsl(0, 0%, 95%)',
    labelColor: 'hsl(0, 0%, 20%)',
    textColor: 'hsl(0, 0%, 20%)',
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", system-ui, sans-serif',
  },
  flowchart: {
    curve: 'basis',
    padding: 20,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 30,
    messageMargin: 45,
  },
});

interface CodeBlockComponentProps {
  node: any;
  updateAttributes: (attributes: Record<string, any>) => void;
  extension: any;
  selected: boolean;
}

export const CodeBlockComponent: React.FC<CodeBlockComponentProps> = ({
  node,
  updateAttributes,
  extension,
  selected,
}) => {
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const language = node.attrs.language || '';
  const isMermaid = language.toLowerCase() === 'mermaid';

  // Get the text content from the code block
  const getCodeContent = () => {
    return node.textContent || '';
  };

  // Render Mermaid diagram
  useEffect(() => {
    if (!isMermaid) {
      setRenderedSvg('');
      setError(null);
      return;
    }

    const code = getCodeContent();
    if (!code.trim()) {
      setRenderedSvg('');
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      setIsRendering(true);
      try {
        setError(null);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        setRenderedSvg(svg);
      } catch (err: any) {
        setError(err.message || 'Failed to render diagram');
        console.error('Mermaid render error:', err);
      } finally {
        setIsRendering(false);
      }
    };

    // Debounce rendering
    const timeoutId = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeoutId);
  }, [isMermaid, node.textContent]);

  return (
    <NodeViewWrapper className="code-block-wrapper" data-language={language}>
      <div
        className={cn(
          'relative my-4 rounded-lg border border-border bg-muted/30 overflow-hidden',
          selected && 'ring-2 ring-primary ring-offset-2',
        )}
        data-language={language}
      >
        {/* Mermaid: Show diagram or code based on toggle */}
        {isMermaid ? (
          showCode ? (
            // Code editor for Mermaid
            <div className="p-4">
              <pre className="bg-code-bg rounded-md">
                <NodeViewContent as="code" className="hljs" />
              </pre>
            </div>
          ) : (
            // Diagram view for Mermaid
            <div className="p-4 bg-background">
              {isRendering ? (
                <div className="flex justify-center items-center min-h-[200px]">
                  <div className="text-sm text-muted-foreground">Rendering diagram...</div>
                </div>
              ) : error ? (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">Mermaid Error</p>
                  <p className="text-xs text-destructive/80 mt-1 font-mono">{error}</p>
                  <button
                    type="button"
                    onClick={() => setShowCode(true)}
                    className="mt-3 text-xs text-destructive underline hover:no-underline"
                  >
                    Edit code to fix
                  </button>
                </div>
              ) : renderedSvg ? (
                <div
                  ref={diagramRef}
                  className="flex justify-center items-center min-h-[100px] mermaid-preview"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : (
                <div className="flex justify-center items-center min-h-[100px]">
                  <div className="text-sm text-muted-foreground">
                    Start typing Mermaid syntax to see the diagram...
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          // Regular code block - always show code
          <div>
            <pre className="bg-code-bg">
              <NodeViewContent as="code" className="hljs" />
            </pre>
          </div>
        )}
      </div>

      {/* Toolbar with language selector and Mermaid toggle */}
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {/* Mermaid toggle button */}
        {isMermaid && (
          <button
            type="button"
            contentEditable={false}
            onClick={() => setShowCode(!showCode)}
            className={cn(
              'px-3 py-1 text-xs rounded bg-background/90 backdrop-blur-sm',
              'border border-border text-foreground cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
              'hover:bg-accent transition-colors',
              'font-medium',
            )}
          >
            {showCode ? 'View Diagram' : 'Edit Code'}
          </button>
        )}

        {/* Language selector dropdown */}
        <select
          contentEditable={false}
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className={cn(
            'px-2 py-1 text-xs rounded bg-background/90 backdrop-blur-sm',
            'border border-border text-foreground cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
            'hover:bg-accent transition-colors',
          )}
        >
        <option value="">auto</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="csharp">C#</option>
        <option value="go">Go</option>
        <option value="rust">Rust</option>
        <option value="ruby">Ruby</option>
        <option value="php">PHP</option>
        <option value="swift">Swift</option>
        <option value="kotlin">Kotlin</option>
        <option value="sql">SQL</option>
        <option value="bash">Bash</option>
        <option value="json">JSON</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="markdown">Markdown</option>
        <option value="mermaid">Mermaid</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
};
