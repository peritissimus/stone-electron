/**
 * Code Block Component - Enhanced code block with diagram rendering
 * Supports:
 * - Mermaid: Standard mermaid diagrams
 * - FlowDSL: Custom simplified syntax that converts to Mermaid
 */

import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { cn } from '@renderer/lib/utils';
import { loadLanguage } from '@renderer/hooks/useTipTapEditor';
import { convertFlowDSLToMermaid } from '@renderer/lib/flowdsl-parser';
import { logger } from '@renderer/utils/logger';

// Lazy load Mermaid - 800KB saved from initial bundle!
let mermaidModule: typeof import('mermaid') | null = null;
let mermaidInitializedTheme: string | null = null;
let mermaidRenderCounter = 0;

// Cache for rendered SVGs to avoid re-rendering same content
const svgCache = new Map<string, string>();

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
        foreground: 'hsl(0 0% 15%)',
        border: 'hsl(0 0% 70%)',
        primary: 'hsl(211 100% 45%)',
        accent: 'hsl(211 100% 95%)',
        muted: 'hsl(0 0% 95%)',
        mutedFg: 'hsl(0 0% 40%)',
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

  // Dark mode: dark nodes with light text/borders. Light mode: light nodes with dark text/borders
  const lineTone = isDark ? 'hsl(0 0% 70%)' : 'hsl(0 0% 45%)';
  const nodePrimary = isDark ? 'hsl(0 0% 18%)' : 'hsl(0 0% 98%)';
  const nodeSecondary = isDark ? 'hsl(0 0% 22%)' : 'hsl(0 0% 96%)';
  const nodeTertiary = isDark ? 'hsl(0 0% 25%)' : 'hsl(0 0% 94%)';
  const nodeText = isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 15%)';
  const labelBackground = withAlpha(card || background, isDark ? 0.8 : 0.9);

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    htmlLabels: false,
    themeVariables: {
      // Core palette mapped from tokens
      primaryColor: nodePrimary,
      primaryTextColor: nodeText,
      primaryBorderColor: lineTone,

      secondaryColor: nodeSecondary,
      secondaryTextColor: nodeText,
      secondaryBorderColor: lineTone,

      tertiaryColor: nodeTertiary,
      tertiaryTextColor: nodeText,
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
      textColor: nodeText,
      labelColor: nodeText,
      fontSize: '15px',
      fontFamily: overrides.fontFamily || MERMAID_FONT_STACK,

      // Class/state diagram specifics
      classText: nodeText,
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
      stateTextColor: nodeText,
      noteBkgColor: nodeSecondary,
      noteBorderColor: lineTone,
      actorBorderColor: lineTone,
      actorLineColor: lineTone,
      actorBkg: nodePrimary,
      signalColor: lineTone,
      signalTextColor: nodeText,
      ganttTaskLineColor: lineTone,
      ganttTaskColor: nodeSecondary,
      ganttConnectorStrokeColor: lineTone,
      ganttOutsideLineColor: lineTone,
      sectionBorderColor: lineTone,

      // Flowchart specific
      nodeBkg: nodePrimary,
      nodeTextColor: nodeText,
      clusterBkg: nodeSecondary,
    },
    flowchart: {
      curve: 'basis',
      padding: 20,
      nodeSpacing: 50,
      rankSpacing: 50,
      diagramPadding: 16,
      htmlLabels: false,
      useMaxWidth: false,
      defaultRenderer: 'dagre-wrapper',
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

// Post-process SVG to fix Mermaid's foreignObject text sizing issues
const fixMermaidForeignObjects = (svg: string): string => {
  // Create a temporary container to parse the SVG
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  // Find all foreignObject elements in nodes
  const foreignObjects = doc.querySelectorAll('.node foreignObject');

  foreignObjects.forEach((fo) => {
    const foElement = fo as SVGForeignObjectElement;
    const div = foElement.querySelector('div');

    if (div) {
      // Get the parent node's rect to determine proper width
      const nodeGroup = foElement.closest('.node');
      const rect = nodeGroup?.querySelector('rect, ellipse, polygon, circle');

      if (rect) {
        // Get the rect's width
        let nodeWidth = 0;
        if (rect.tagName === 'rect') {
          nodeWidth = parseFloat(rect.getAttribute('width') || '0');
        } else if (rect.tagName === 'ellipse') {
          nodeWidth = parseFloat(rect.getAttribute('rx') || '0') * 2;
        } else if (rect.tagName === 'circle') {
          nodeWidth = parseFloat(rect.getAttribute('r') || '0') * 2;
        } else if (rect.tagName === 'polygon') {
          // For diamonds/polygons, estimate from points
          const points = rect.getAttribute('points')?.split(' ') || [];
          const xs = points.map((p) => parseFloat(p.split(',')[0]) || 0);
          nodeWidth = Math.max(...xs) - Math.min(...xs);
        }

        if (nodeWidth > 0) {
          // Set foreignObject to match node width, centered
          const padding = 10;
          const newWidth = nodeWidth - padding * 2;
          const currentX = parseFloat(foElement.getAttribute('x') || '0');
          const currentWidth = parseFloat(foElement.getAttribute('width') || '0');
          const centerX = currentX + currentWidth / 2;
          const newX = centerX - newWidth / 2;

          foElement.setAttribute('width', String(newWidth));
          foElement.setAttribute('x', String(newX));

          // Fix the inner div styling
          div.setAttribute(
            'style',
            'display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; text-align: center; white-space: nowrap;'
          );
        }
      }
    }
  });

  // Serialize back to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
};

// Delay initialization until we render (handled inside effect)

interface CodeBlockComponentProps {
  node: any;
  updateAttributes: (attributes: Record<string, any>) => void;
  extension: any;
  editor: any;
  getPos: () => number;
  selected: boolean;
}

// Interface for inline editing state
interface EditingState {
  nodeId: string;
  label: string;
  x: number;
  y: number;
  width: number;
}

export const CodeBlockComponent: React.FC<CodeBlockComponentProps> = ({
  node,
  updateAttributes,
  extension,
  editor,
  getPos,
  selected,
}) => {
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingReady, setEditingReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const diagramRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Render diagram (Mermaid or FlowDSL)
  useEffect(() => {
    if (!isDiagram) {
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
      try {
        setError(null);

        // Convert FlowDSL to Mermaid if needed
        let mermaidCode = code;
        if (isFlowDSL) {
          try {
            mermaidCode = convertFlowDSLToMermaid(code);
          } catch (parseErr: any) {
            setError(parseErr.message || 'Failed to parse FlowDSL');
            return;
          }
        }

        // Check cache first - avoid re-rendering same content
        const cacheKey = `${mermaidCode}:${isDarkMode}:${isStateDiagram}`;
        const cachedSvg = svgCache.get(cacheKey);
        if (cachedSvg) {
          setRenderedSvg(cachedSvg);
          return;
        }

        setIsRendering(true);

        // Dynamically load Mermaid (only when needed - saves 800KB from initial bundle!)
        const mermaid = await loadMermaid();

        // Only re-initialize Mermaid when theme changes
        const currentTheme = isDarkMode ? 'dark' : 'light';
        if (mermaidInitializedTheme !== currentTheme) {
          initializeMermaid(mermaid, isDarkMode, isStateDiagram ? { fontFamily: MERMAID_FONT_STACK } : {});
          mermaidInitializedTheme = currentTheme;
        }

        // Use incrementing counter instead of random ID for stability
        const id = `mermaid-${++mermaidRenderCounter}`;
        const { svg } = await mermaid.render(id, mermaidCode);

        // Post-process SVG to fix foreignObject text sizing issues
        const fixedSvg = fixMermaidForeignObjects(svg);

        // Cache the result
        svgCache.set(cacheKey, fixedSvg);

        // Limit cache size to prevent memory issues
        if (svgCache.size > 50) {
          const firstKey = svgCache.keys().next().value;
          if (firstKey) svgCache.delete(firstKey);
        }

        setRenderedSvg(fixedSvg);
      } catch (err: any) {
        setError(err.message || 'Failed to render diagram');
        logger.error('Diagram render error:', err);
      } finally {
        setIsRendering(false);
      }
    };

    // Debounce rendering
    const timeoutId = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeoutId);
  }, [isDiagram, isFlowDSL, node.textContent, isDarkMode]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
      // Delay enabling blur handler to prevent immediate firing
      const timeout = setTimeout(() => setEditingReady(true), 100);
      return () => clearTimeout(timeout);
    } else {
      setEditingReady(false);
    }
  }, [editing]);

  // Handle double-click on diagram to edit node labels
  const handleDiagramDoubleClick = (e: React.MouseEvent) => {
    logger.debug('[Diagram] Double-click detected');
    if (!diagramRef.current) {
      logger.debug('[Diagram] No diagramRef');
      return;
    }

    // Find the clicked node
    const target = e.target as Element;
    logger.debug('[Diagram] Target element:', target.tagName, target.className);

    const nodeGroup = target.closest('.node');
    if (!nodeGroup) {
      logger.debug('[Diagram] No .node parent found');
      return;
    }

    // Get node ID from the group
    const nodeId = nodeGroup.id || '';
    logger.debug('[Diagram] Node ID:', nodeId);

    const nodeIdMatch = nodeId.match(/flowchart-(\w+)-\d+/);
    const extractedId = nodeIdMatch ? nodeIdMatch[1] : '';
    logger.debug('[Diagram] Extracted ID:', extractedId);

    // Find the label text - check multiple possible locations
    let labelText = '';

    // Try .nodeLabel first (htmlLabels: true)
    const nodeLabelElement = nodeGroup.querySelector('.nodeLabel');
    if (nodeLabelElement) {
      labelText = nodeLabelElement.textContent?.trim() || '';
    }

    // Try SVG text/tspan (htmlLabels: false)
    if (!labelText) {
      const textElement = nodeGroup.querySelector('text');
      if (textElement) {
        labelText = textElement.textContent?.trim() || '';
      }
    }

    // Try foreignObject div
    if (!labelText) {
      const foreignDiv = nodeGroup.querySelector('foreignObject div');
      if (foreignDiv) {
        labelText = foreignDiv.textContent?.trim() || '';
      }
    }

    logger.debug('[Diagram] Label text:', labelText);

    if (!labelText) {
      logger.debug('[Diagram] No label text found');
      return;
    }

    // Get position relative to diagram container
    const containerRect = diagramRef.current.getBoundingClientRect();
    const nodeRect = nodeGroup.getBoundingClientRect();

    // Calculate position for the edit input (relative to the bg-background container)
    const parentContainer = diagramRef.current.parentElement;
    const parentRect = parentContainer?.getBoundingClientRect() || containerRect;

    const x = nodeRect.left - parentRect.left + nodeRect.width / 2;
    const y = nodeRect.top - parentRect.top + nodeRect.height / 2;
    const width = Math.max(nodeRect.width - 10, 120);

    logger.debug('[Diagram] Setting editing state:', { extractedId, labelText, x, y, width });

    setEditing({
      nodeId: extractedId || labelText.toLowerCase().replace(/\s+/g, '_'),
      label: labelText,
      x,
      y,
      width,
    });
  };

  // Update the source code with the new label
  const updateSourceLabel = (nodeId: string, oldLabel: string, newLabel: string) => {
    if (oldLabel === newLabel || !newLabel.trim()) return;

    const code = codeContent;
    let updatedCode = code;

    if (isFlowDSL) {
      // For FlowDSL, replace the node definition line
      // Pattern: "Old Label [props]" or just "Old Label"
      const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(\\s*)(${escapedOld})(\\s*\\[|\\s*$)`, 'gm');
      updatedCode = code.replace(regex, `$1${newLabel}$3`);

      // Also update relationships that reference this node
      const oldInRelation = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Update "OldLabel > " patterns
      updatedCode = updatedCode.replace(
        new RegExp(`(^|\\s)(${oldInRelation})(\\s*[><]\\s*)`, 'gm'),
        `$1${newLabel}$3`
      );
      // Update " > OldLabel" patterns
      updatedCode = updatedCode.replace(
        new RegExp(`(\\s*[><]\\s*)(${oldInRelation})(\\s*:|\\s*$)`, 'gm'),
        `$1${newLabel}$3`
      );
    } else {
      // For Mermaid, replace the label in node definitions
      // Pattern: nodeId["Old Label"] or nodeId("Old Label") etc.
      const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${nodeId}[\\[\\(\\{\\|<]+["']?)${escapedOld}(["']?[\\]\\)\\}>|]+)`, 'gi');
      updatedCode = code.replace(regex, `$1${newLabel}$2`);
    }

    if (updatedCode !== code && editor) {
      // Update the node content through TipTap
      const { view, state } = editor;
      const { tr } = state;

      // Get the position of this code block
      const pos = getPos();
      if (pos !== undefined) {
        const codeBlockNode = state.doc.nodeAt(pos);

        if (codeBlockNode && codeBlockNode.type.name === 'codeBlock') {
          // Replace the text content
          const from = pos + 1;
          const to = from + codeBlockNode.content.size;
          tr.replaceWith(from, to, state.schema.text(updatedCode));
          view.dispatch(tr);
          logger.debug('[Diagram] Updated source code');
        }
      }
    }
  };

  // Handle edit completion
  const handleEditComplete = (newLabel: string) => {
    if (editing) {
      updateSourceLabel(editing.nodeId, editing.label, newLabel);
      setEditing(null);
    }
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditing(null);
  };

  return (
    <NodeViewWrapper className="code-block-wrapper" data-language={language}>
      <div
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
            // Diagram preview
            <div className="p-4 bg-background relative">
              {isRendering ? (
                <div className="flex justify-center items-center min-h-[200px]">
                  <div className="text-sm text-muted-foreground">Rendering diagram...</div>
                </div>
              ) : error ? (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    {isFlowDSL ? 'FlowDSL Error' : 'Mermaid Error'}
                  </p>
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
                <>
                  <div
                    ref={diagramRef}
                    contentEditable={false}
                    suppressContentEditableWarning
                    className={cn(
                      'flex justify-center items-center min-h-[100px] mermaid-preview relative select-none',
                      isStateDiagram && 'mermaid-state-diagram',
                    )}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDiagramDoubleClick(e);
                    }}
                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                  />
                  {/* Inline edit overlay */}
                  {editing && (
                    <div
                      className="absolute z-50 rounded-xl"
                      style={{
                        left: editing.x,
                        top: editing.y,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 3px hsl(var(--primary)), 0 10px 40px rgba(0,0,0,0.5)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        defaultValue={editing.label}
                        className={cn(
                          'px-4 py-2.5 text-sm rounded-xl border-0',
                          'text-foreground bg-overlay',
                          'focus:outline-none',
                          'text-center font-medium',
                        )}
                        style={{
                          width: editing.width,
                          minWidth: 140,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleEditComplete((e.target as HTMLInputElement).value);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleEditCancel();
                          }
                        }}
                        onBlur={(e) => {
                          if (editingReady) {
                            handleEditComplete(e.target.value);
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-center items-center min-h-[100px]">
                  <div className="text-sm text-muted-foreground">
                    {isFlowDSL
                      ? 'Start typing FlowDSL syntax to see the diagram...'
                      : 'Start typing Mermaid syntax to see the diagram...'}
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

        {/* Toolbar with language selector and diagram toggle - visible on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {/* Diagram toggle button (Mermaid or FlowDSL) */}
        {isDiagram && (
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
          <option value="flowdsl">FlowDSL</option>
        </select>
        </div>
      </div>
    </NodeViewWrapper>
  );
};
