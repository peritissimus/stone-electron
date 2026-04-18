/**
 * Mermaid Utilities - Initialization and rendering helpers for Mermaid diagrams
 */

import { logger } from '@renderer/lib/logger';

// Lazy load Mermaid - 800KB saved from initial bundle!
let mermaidModule: typeof import('mermaid') | null = null;
let mermaidInitializedTheme: string | null = null;
let mermaidRenderCounter = 0;

// Cache for rendered SVGs to avoid re-rendering same content
const svgCache = new Map<string, string>();

/**
 * Font stack for state diagrams (handwriting style)
 */
export const MERMAID_FONT_STACK =
  "'Patrick Hand', 'Bradley Hand', 'Noteworthy', 'Chalkboard SE', 'Segoe Print', cursive";

/**
 * Lazy load the Mermaid library
 */
export async function loadMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
  }
  return mermaidModule.default;
}

/**
 * Get the current theme from the document
 */
export function getTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Read a CSS variable and return a valid CSS color string
 */
export function cssVarColor(name: string, fallback?: string): string {
  if (typeof window === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback || '';
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
  // Our tokens are HSL triples like "211 100% 50%"; wrap as hsl(...)
  return `hsl(${v})`;
}

/**
 * Add alpha channel to a color string
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  const clampAlpha = Math.min(Math.max(alpha, 0), 1);

  // Convert any color to rgba for maximum compatibility with Mermaid
  if (color.includes('/')) {
    color = color.replace(/\s*\/\s*[\d.]+\s*\)$/, ')');
  }

  if (color.startsWith('hsla(')) {
    return color.replace(/,\s*[\d.]+\s*\)$/, `, ${clampAlpha})`);
  }

  if (color.startsWith('hsl(')) {
    const inner = color.slice(4, -1).trim();
    if (inner.includes(',')) {
      return `hsla(${inner}, ${clampAlpha})`;
    } else {
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
}

/**
 * Theme configuration for Mermaid
 */
interface MermaidOverrides {
  fontFamily?: string;
}

/**
 * Initialize Mermaid with theme derived from design tokens (CSS variables)
 */
export function initializeMermaid(
  mermaid: typeof import('mermaid').default,
  isDark = false,
  overrides: MermaidOverrides = {},
) {
  // Safe fallbacks matching CSS variables in index.css
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
  const card = cssVarColor('--card', F.card);

  // Dark mode: dark nodes with light text/borders
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
      primaryColor: nodePrimary,
      primaryTextColor: nodeText,
      primaryBorderColor: lineTone,
      secondaryColor: nodeSecondary,
      secondaryTextColor: nodeText,
      secondaryBorderColor: lineTone,
      tertiaryColor: nodeTertiary,
      tertiaryTextColor: nodeText,
      tertiaryBorderColor: lineTone,
      mainBkg: nodePrimary,
      secondBkg: nodeSecondary,
      tertiaryBkg: nodeTertiary,
      lineColor: lineTone,
      edgeColor: lineTone,
      arrowheadColor: lineTone,
      edgeLabelBackground: labelBackground,
      textColor: nodeText,
      labelColor: nodeText,
      fontSize: '15px',
      fontFamily: overrides.fontFamily || MERMAID_FONT_STACK,
      classText: nodeText,
      labelBoxBkgColor: nodeSecondary,
      labelBoxBorderColor: lineTone,
      git0: lineTone,
      git1: lineTone,
      git2: lineTone,
      git3: lineTone,
      git4: lineTone,
      git5: lineTone,
      git6: lineTone,
      git7: lineTone,
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
      nodeBkg: nodePrimary,
      nodeTextColor: nodeText,
      clusterBkg: nodeSecondary,
      // ER diagram specific
      attributeBackgroundColorOdd: nodePrimary,
      attributeBackgroundColorEven: nodeSecondary,
      entityBkg: nodePrimary,
      entityBorderColor: lineTone,
      relationshipColor: lineTone,
      relationshipLabelBackground: labelBackground,
      relationshipLabelColor: nodeText,
    },
    er: {
      useMaxWidth: false,
      entityPadding: 15,
      fontSize: 14,
      fill: nodePrimary,
      stroke: lineTone,
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
}

/**
 * Post-process SVG to fix ER diagram colors for dark mode
 */
export function fixERDiagramColors(svg: string, isDark: boolean): string {
  // Check if this is an ER diagram
  if (!svg.includes('entity-') && !svg.includes('row-rect-')) {
    return svg; // Not an ER diagram
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  // Fix row-rect-odd paths (attribute rows) - these have light fill that needs to be dark
  const rowOddGroups = doc.querySelectorAll('.row-rect-odd');
  rowOddGroups.forEach((group) => {
    const paths = group.querySelectorAll('path');
    paths.forEach((path) => {
      const fill = path.getAttribute('fill');
      // Only fix if it has a light fill (high lightness value)
      if (fill && (fill.includes('93%') || fill.includes('95%') || fill.includes('100%'))) {
        path.setAttribute('fill', isDark ? 'hsl(0, 0%, 25%)' : 'hsl(0, 0%, 95%)');
      }
    });
  });

  // Fix row-rect-even paths
  const rowEvenGroups = doc.querySelectorAll('.row-rect-even');
  rowEvenGroups.forEach((group) => {
    const paths = group.querySelectorAll('path');
    paths.forEach((path) => {
      const fill = path.getAttribute('fill');
      if (fill) {
        path.setAttribute('fill', isDark ? 'hsl(0, 0%, 18%)' : 'hsl(0, 0%, 100%)');
      }
    });
  });

  // Fix all path fills in entity nodes that have light colors in dark mode
  if (isDark) {
    const entityNodes = doc.querySelectorAll('g[id^="entity-"]');
    entityNodes.forEach((node) => {
      const paths = node.querySelectorAll('path[fill]');
      paths.forEach((path) => {
        const fill = path.getAttribute('fill');
        // Fix any light fills (high percentage in hsl)
        if (fill && /hsl\([^)]*(?:9\d|100)%\s*\)/.test(fill)) {
          path.setAttribute('fill', 'hsl(0, 0%, 25%)');
        }
      });
    });
  }

  // Fix text colors in ER diagrams
  const textColor = isDark ? 'hsl(0, 0%, 90%)' : 'hsl(0, 0%, 15%)';

  // Fix all text elements in entity nodes
  const textElements = doc.querySelectorAll('g[id^="entity-"] text');
  textElements.forEach((text) => {
    text.setAttribute('fill', textColor);
  });

  // Fix tspan elements that might have their own fill
  const tspanElements = doc.querySelectorAll('g[id^="entity-"] tspan');
  tspanElements.forEach((tspan) => {
    tspan.setAttribute('fill', textColor);
  });

  // Fix edge labels (relationship labels like "has", "owns", etc.)
  const edgeLabels = doc.querySelectorAll('.edgeLabel text, .edgeLabel tspan');
  edgeLabels.forEach((el) => {
    el.setAttribute('fill', textColor);
  });

  // Fix background rects in labels
  const labelBgs = doc.querySelectorAll('.edgeLabel .background, .label .background');
  labelBgs.forEach((bg) => {
    bg.setAttribute('fill', isDark ? 'hsl(0, 0%, 15%)' : 'hsl(0, 0%, 98%)');
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
}

/**
 * Post-process SVG to fix Mermaid's foreignObject text sizing issues
 */
export function fixMermaidForeignObjects(svg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  const foreignObjects = doc.querySelectorAll('.node foreignObject');

  foreignObjects.forEach((fo) => {
    const foElement = fo as SVGForeignObjectElement;
    const div = foElement.querySelector('div');

    if (div) {
      const nodeGroup = foElement.closest('.node');
      const rect = nodeGroup?.querySelector('rect, ellipse, polygon, circle');

      if (rect) {
        let nodeWidth = 0;
        if (rect.tagName === 'rect') {
          nodeWidth = parseFloat(rect.getAttribute('width') || '0');
        } else if (rect.tagName === 'ellipse') {
          nodeWidth = parseFloat(rect.getAttribute('rx') || '0') * 2;
        } else if (rect.tagName === 'circle') {
          nodeWidth = parseFloat(rect.getAttribute('r') || '0') * 2;
        } else if (rect.tagName === 'polygon') {
          const points = rect.getAttribute('points')?.split(' ') || [];
          const xs = points.map((p) => parseFloat(p.split(',')[0]) || 0);
          nodeWidth = Math.max(...xs) - Math.min(...xs);
        }

        if (nodeWidth > 0) {
          const padding = 10;
          const newWidth = nodeWidth - padding * 2;
          const currentX = parseFloat(foElement.getAttribute('x') || '0');
          const currentWidth = parseFloat(foElement.getAttribute('width') || '0');
          const centerX = currentX + currentWidth / 2;
          const newX = centerX - newWidth / 2;

          foElement.setAttribute('width', String(newWidth));
          foElement.setAttribute('x', String(newX));

          div.setAttribute(
            'style',
            'display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; text-align: center; white-space: nowrap;',
          );
        }
      }
    }
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
}

/**
 * Render a Mermaid diagram and return the SVG
 */
export async function renderMermaidDiagram(
  code: string,
  isDark: boolean,
  isStateDiagram: boolean,
): Promise<{ svg: string; error?: string }> {
  try {
    // Check cache first
    const cacheKey = `${code}:${isDark}:${isStateDiagram}`;
    const cachedSvg = svgCache.get(cacheKey);
    if (cachedSvg) {
      return { svg: cachedSvg };
    }

    const mermaid = await loadMermaid();

    // Only re-initialize Mermaid when theme changes
    const currentTheme = isDark ? 'dark' : 'light';
    if (mermaidInitializedTheme !== currentTheme) {
      initializeMermaid(mermaid, isDark, isStateDiagram ? { fontFamily: MERMAID_FONT_STACK } : {});
      mermaidInitializedTheme = currentTheme;
    }

    const id = `mermaid-${++mermaidRenderCounter}`;
    const { svg } = await mermaid.render(id, code);
    let fixedSvg = fixMermaidForeignObjects(svg);
    fixedSvg = fixERDiagramColors(fixedSvg, isDark);

    // Cache the result
    svgCache.set(cacheKey, fixedSvg);

    // Limit cache size
    if (svgCache.size > 50) {
      const firstKey = svgCache.keys().next().value;
      if (firstKey) svgCache.delete(firstKey);
    }

    return { svg: fixedSvg };
  } catch (err: any) {
    logger.error('Mermaid render error:', err);
    return { svg: '', error: err.message || 'Failed to render diagram' };
  }
}

/**
 * Clear the SVG cache (useful for theme changes)
 */
export function clearMermaidCache() {
  svgCache.clear();
  mermaidInitializedTheme = null;
}
