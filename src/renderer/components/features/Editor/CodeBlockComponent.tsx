/**
 * Code Block Component - Enhanced code block with diagram rendering
 * Supports:
 * - Mermaid: Standard mermaid diagrams
 * - FlowDSL: Custom simplified syntax that converts to Mermaid
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { cn } from '@renderer/lib/utils';
import { loadLanguage } from '@renderer/lib/editor/codeLanguages';
import { MermaidRenderer } from './MermaidRenderer';
import { CodeBlockToolbar } from './CodeBlockToolbar';
import { downloadElementAsPng } from '@renderer/lib/download';

interface CodeBlockComponentProps {
  node: any;
  updateAttributes: (attributes: Record<string, any>) => void;
  extension: any;
  editor: any;
  getPos: () => number;
  selected: boolean;
}

export const CodeBlockComponent: React.FC<CodeBlockComponentProps> = ({
  node,
  updateAttributes,
  extension: _extension,
  editor,
  getPos,
  selected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const language = node.attrs.language || '';
  const isMermaid = language.toLowerCase() === 'mermaid';
  const isFlowDSL = language.toLowerCase() === 'flowdsl';
  const isDiagram = isMermaid || isFlowDSL;

  const codeContent = node.textContent || '';

  const handleDownload = useCallback(() => {
    if (!containerRef.current) return;

    const fileName = `code-block${language ? `-${language}` : ''}.png`;
    downloadElementAsPng(containerRef.current, {
      fileName,
      filterSelectors: ['.code-block-toolbar'],
    });
  }, [language]);

  // Pretty-print JSON blocks on demand. Only offered when the block is tagged
  // json/jsonc and the current content actually parses.
  const langKey = language.toLowerCase();
  const canFormat =
    (langKey === 'json' || langKey === 'jsonc') &&
    (() => {
      try {
        JSON.parse(codeContent);
        return true;
      } catch {
        return false;
      }
    })();

  const handleFormat = useCallback(() => {
    if (!editor) return;
    let formatted: string;
    try {
      formatted = JSON.stringify(JSON.parse(codeContent), null, 2);
    } catch {
      return;
    }
    if (formatted === codeContent) return;

    const { view, state } = editor;
    const pos = getPos();
    if (pos === undefined) return;
    const blockNode = state.doc.nodeAt(pos);
    if (!blockNode || blockNode.type.name !== 'codeBlock') return;

    const from = pos + 1;
    const to = from + blockNode.content.size;
    view.dispatch(state.tr.replaceWith(from, to, state.schema.text(formatted)));
  }, [editor, codeContent, getPos]);

  // Load language on demand (lazy loading)
  useEffect(() => {
    if (language && language !== 'mermaid' && language !== 'flowdsl' && language !== 'auto') {
      loadLanguage(language);
    }
  }, [language]);

  // Update the source code with the new label (for diagram editing)
  const handleUpdateSource = (nodeId: string, oldLabel: string, newLabel: string) => {
    if (oldLabel === newLabel || !newLabel.trim()) return;

    let updatedCode = codeContent;

    if (isFlowDSL) {
      // For FlowDSL, replace the node definition line
      const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(\\s*)(${escapedOld})(\\s*\\[|\\s*$)`, 'gm');
      updatedCode = codeContent.replace(regex, `$1${newLabel}$3`);

      // Also update relationships that reference this node
      const oldInRelation = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      updatedCode = updatedCode.replace(
        new RegExp(`(^|\\s)(${oldInRelation})(\\s*[><]\\s*)`, 'gm'),
        `$1${newLabel}$3`,
      );
      updatedCode = updatedCode.replace(
        new RegExp(`(\\s*[><]\\s*)(${oldInRelation})(\\s*:|\\s*$)`, 'gm'),
        `$1${newLabel}$3`,
      );
    } else {
      // For Mermaid, replace the label in node definitions
      const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `(${nodeId}[\\[\\(\\{\\|<]+["']?)${escapedOld}(["']?[\\]\\)\\}>|]+)`,
        'gi',
      );
      updatedCode = codeContent.replace(regex, `$1${newLabel}$2`);
    }

    if (updatedCode !== codeContent && editor) {
      const { view, state } = editor;
      const { tr } = state;

      const pos = getPos();
      if (pos !== undefined) {
        const codeBlockNode = state.doc.nodeAt(pos);

        if (codeBlockNode && codeBlockNode.type.name === 'codeBlock') {
          const from = pos + 1;
          const to = from + codeBlockNode.content.size;
          tr.replaceWith(from, to, state.schema.text(updatedCode));
          view.dispatch(tr);
        }
      }
    }
  };

  return (
    <NodeViewWrapper className="code-block-wrapper" data-language={language}>
      <div
        ref={containerRef}
        className={cn(
          'group relative my-4 rounded-lg border border-border bg-muted/30 overflow-hidden',
          selected && 'ring-2 ring-primary ring-offset-2',
        )}
        data-language={language}
      >
        {/* Diagram view: Show diagram or code based on toggle */}
        {isDiagram ? (
          showCode ? (
            // Code editor for diagrams
            <div className="p-4">
              <pre className="bg-code-bg rounded-md">
                <NodeViewContent as="code" className="hljs" />
              </pre>
            </div>
          ) : (
            // Diagram preview. NodeViewContent must STAY mounted even when
            // we're showing the rendered diagram — it's TipTap's anchor for
            // the node's child text. Without it, ProseMirror can't map the
            // contentDOM and editor.getJSON() returns the node empty, so
            // saving round-trips away the mermaid source. We hide it via
            // sr-only + aria-hidden; the React renderer above is purely
            // decorative.
            <>
              <div className="p-4 bg-background relative">
                <MermaidRenderer
                  code={codeContent}
                  language={isFlowDSL ? 'flowdsl' : 'mermaid'}
                  isDarkMode={isDarkMode}
                  onEditCode={() => setShowCode(true)}
                  onUpdateSource={handleUpdateSource}
                  isFullscreen={isFullscreen}
                  onFullscreenChange={setIsFullscreen}
                />
              </div>
              <pre className="sr-only" aria-hidden="true">
                <NodeViewContent as="code" />
              </pre>
            </>
          )
        ) : (
          // Regular code block - always show code
          <div>
            <pre className="bg-code-bg">
              <NodeViewContent as="code" className="hljs" />
            </pre>
          </div>
        )}

        {/* Toolbar with language selector and diagram toggle */}
        <CodeBlockToolbar
          language={language}
          onLanguageChange={(lang) => updateAttributes({ language: lang })}
          isDiagram={isDiagram}
          showCode={showCode}
          onToggleView={() => setShowCode(!showCode)}
          onFullscreen={() => setIsFullscreen(true)}
          codeContent={codeContent}
          onDownload={handleDownload}
          canFormat={canFormat}
          onFormat={handleFormat}
        />
      </div>
    </NodeViewWrapper>
  );
};
