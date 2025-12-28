/**
 * Code Block Component - Enhanced code block with Mermaid diagram rendering
 * Automatically detects "mermaid" language and renders diagrams like Notion/GitHub
 */

import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { cn } from '@renderer/lib/utils';
import { loadLanguage } from '@renderer/hooks/useTipTapEditor';

// Lazy load Mermaid - 800KB saved from initial bundle!
let mermaidModule: typeof import('mermaid') | null = null;
const loadMermaid = async () => {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
  }
  return mermaidModule.default;
};

// Get initial theme
const getTheme = () => {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
  return 'light';
};

// Helper to read CSS variable and return a valid CSS color string
const cssVarColor = (name: string, fallback?: string) => {
  if (typeof window === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback || '';
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
  // Our tokens are HSL triples like "211 100% 50%"; wrap as hsl(...)
  return `hsl(${v})`;
};

const MERMAID_FONT_STACK =
  "'Patrick Hand', 'Bradley Hand', 'Noteworthy', 'Chalkboard SE', 'Segoe Print', cursive";

const withAlpha = (color: string, alpha: number) => {
  if (!color) return color;
  const clampAlpha = Math.min(Math.max(alpha, 0), 1);

  // Convert any color to rgba for maximum compatibility with Mermaid
  // First, handle colors that already have alpha (hsla, rgba, or modern syntax with /)
  if (color.includes('/')) {
    // Modern syntax like "hsl(220 40% 50% / 0.5)" - strip existing alpha
    color = color.replace(/\s*\/\s*[\d.]+\s*\)$/, ')');
  }

  if (color.startsWith('hsla(')) {
    // Old hsla syntax - replace the alpha
    return color.replace(/,\s*[\d.]+\s*\)$/, `, ${clampAlpha})`);
  }

  if (color.startsWith('hsl(')) {
    const inner = color.slice(4, -1).trim();
    // Check if it's comma-separated (old) or space-separated (modern)
    if (inner.includes(',')) {
      // Old syntax: hsl(220, 40%, 50%)
      return `hsla(${inner}, ${clampAlpha})`;
    } else {
      // Modern syntax: hsl(220 40% 50%) - convert to old hsla for compatibility
      const parts = inner.split(/\s+/);
      if (parts.length >= 3) {
        return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clampAlpha})`;
      }
    }
  }

  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\s*\)$/, `, ${clampAlpha})`);
  }

  if (color.startsWith('rgb(')) {
    const inner = color.slice(4, -1).trim();
    if (inner.includes(',')) {
      return `rgba(${inner}, ${clampAlpha})`;
    } else {
      // Modern syntax: rgb(255 0 0)
      const parts = inner.split(/\s+/);
      if (parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clampAlpha})`;
      }
    }
  }

  if (color.startsWith('#')) {
    let r = 0;
    let g = 0;
    let b = 0;

    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else if (color.length === 7) {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${clampAlpha})`;
  }

  return color;
};

// Initialize Mermaid with theme derived from design tokens (CSS variables)
type MermaidOverrides = { fontFamily?: string };

const initializeMermaid = (
  mermaid: typeof import('mermaid').default,
  isDark = false,
  overrides: MermaidOverrides = {},
) => {
  // Safe fallbacks matching CSS variables in index.css (used only if CSS vars unavailable)
  // Light: --background: 0 0% 100%, --foreground: 0 0% 12%, --border: 0 0% 90%, etc.
  // Dark: --background: 0 0% 11%, --foreground: 0 0% 92%, --border: 0 0% 22%, etc.
  const F = isDark
    ? {
        background: 'hsl(0 0% 11%)',
        foreground: 'hsl(0 0% 92%)',
        border: 'hsl(0 0% 22%)',
        primary: 'hsl(211 100% 60%)',
        accent: 'hsl(211 100% 20%)',
        muted: 'hsl(0 0% 20%)',
        mutedFg: 'hsl(0 0% 60%)',
        card: 'hsl(0 0% 15%)',
      }
    : {
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(0 0% 12%)',
        border: 'hsl(0 0% 90%)',
        primary: 'hsl(211 100% 50%)',
        accent: 'hsl(211 100% 97%)',
        muted: 'hsl(0 0% 97%)',
        mutedFg: 'hsl(0 0% 50%)',
        card: 'hsl(0 0% 100%)',
      };

  const background = cssVarColor('--background', F.background);
  const foreground = cssVarColor('--foreground', F.foreground);
  const border = cssVarColor('--border', F.border);
  const primary = cssVarColor('--primary', F.primary);
  const accent = cssVarColor('--accent', F.accent);
  const muted = cssVarColor('--muted', F.muted);
  const mutedFg = cssVarColor('--muted-foreground', F.mutedFg);
  const card = cssVarColor('--card', F.card);

  const lineTone = foreground || border;
  const nodePrimary = 'transparent';
  const nodeSecondary = 'transparent';
  const nodeTertiary = 'transparent';
  const labelBackground = withAlpha(card || background, isDark ? 0.45 : 0.6);

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      // Core palette mapped from tokens
      primaryColor: nodePrimary,
      primaryTextColor: foreground,
      primaryBorderColor: lineTone,

      secondaryColor: nodeSecondary,
      secondaryTextColor: foreground,
      secondaryBorderColor: lineTone,

      tertiaryColor: nodeTertiary,
      tertiaryTextColor: foreground,
      tertiaryBorderColor: lineTone,

      // Node backgrounds
      mainBkg: nodePrimary,
      secondBkg: nodeSecondary,
      tertiaryBkg: nodeTertiary,

      // Lines and labels
      lineColor: lineTone,
      edgeColor: lineTone,
      arrowheadColor: lineTone,
      edgeLabelBackground: labelBackground,

      // Text
      textColor: foreground,
      labelColor: foreground,
      fontSize: '15px',
      fontFamily: overrides.fontFamily || MERMAID_FONT_STACK,

      // Class/state diagram specifics
      classText: foreground,
      labelBoxBkgColor: nodeSecondary,
      labelBoxBorderColor: lineTone,

      // Git graph palette uses monochrome harmony
      git0: lineTone,
      git1: lineTone,
      git2: lineTone,
      git3: lineTone,
      git4: lineTone,
      git5: lineTone,
      git6: lineTone,
      git7: lineTone,

      // StateDiagram-v2 specifics
      stateBkg: nodePrimary,
      stateBorder: lineTone,
      transitionColor: lineTone,
      compositeBackground: nodeSecondary,
      compositeTitleBackground: nodeSecondary,
      // Some versions may look for stateTextColor; fall back to textColor
      stateTextColor: foreground,
      noteBkgColor: nodeSecondary,
      noteBorderColor: lineTone,
      actorBorderColor: lineTone,
      actorLineColor: lineTone,
      actorBkg: nodePrimary,
      signalColor: lineTone,
      signalTextColor: foreground,
      ganttTaskLineColor: lineTone,
      ganttTaskColor: nodeSecondary,
      ganttConnectorStrokeColor: lineTone,
      ganttOutsideLineColor: lineTone,
      sectionBorderColor: lineTone,
    },
    flowchart: {
      curve: 'basis',
      padding: 20,
      nodeSpacing: 56,
      rankSpacing: 56,
      diagramPadding: 16,
      htmlLabels: true,
    },
    sequence: {
      diagramMarginX: 40,
      diagramMarginY: 24,
      messageMargin: 40,
      boxMargin: 8,
      boxTextMargin: 6,
      noteMargin: 8,
      messageAlign: 'center',
    },
    gantt: {
      numberSectionStyles: 4,
      axisFormat: '%m/%d',
    },
  });
};

// Delay initialization until we render (handled inside effect)

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

  const codeContent = getCodeContent();
  const isStateDiagram = /(^|\n)\s*stateDiagram(-v2)?/i.test(codeContent);

  // Load language on demand (lazy loading)
  useEffect(() => {
    if (language && language !== 'mermaid' && language !== 'auto') {
      loadLanguage(language);
    }
  }, [language]);

  // Render Mermaid diagram
  useEffect(() => {
    if (!isMermaid) {
      setRenderedSvg('');
      setError(null);
      return;
    }

    const code = codeContent;
    if (!code.trim()) {
      setRenderedSvg('');
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      setIsRendering(true);
      try {
        setError(null);

        // Dynamically load Mermaid (only when needed - saves 800KB from initial bundle!)
        const mermaid = await loadMermaid();

        // Re-initialize Mermaid with current theme before rendering
        const isDark = document.documentElement.classList.contains('dark');
        initializeMermaid(mermaid, isDark, isStateDiagram ? { fontFamily: MERMAID_FONT_STACK } : {});

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
                  className={cn(
                    'flex justify-center items-center min-h-[100px] mermaid-preview',
                    isStateDiagram && 'mermaid-state-diagram',
                  )}
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

        {/* Language selector dropdown */}
        <select
          contentEditable={false}
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className={cn(
            'px-2 py-1 text-xs rounded bg-background/90 backdrop-blur-xs',
            'border border-border text-foreground cursor-pointer',
            'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
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
