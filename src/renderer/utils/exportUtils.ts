/**
 * Export Utilities - Capture pre-rendered editor content for PDF/HTML export
 *
 * This module captures the actual rendered content from the editor DOM,
 * including Mermaid diagrams as SVGs, syntax-highlighted code, and all applied styles.
 */

import { Editor } from '@tiptap/react';

/**
 * Google Fonts URL for all fonts used in the app
 */
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Barlow+Semi+Condensed:wght@600;700&family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700&family=Patrick+Hand&display=swap';

/**
 * Get the rendered HTML content from the editor's DOM element.
 * This captures the actual rendered content including:
 * - Mermaid diagrams as SVGs
 * - Syntax highlighted code
 * - All applied styles
 */
export function getRenderedEditorContent(editor: Editor): string {
  // Get the ProseMirror DOM element which has the rendered content
  const editorElement = editor.view.dom as HTMLElement;

  // Clone the content to avoid modifying the original
  const clone = editorElement.cloneNode(true) as HTMLElement;

  // Remove any editor-specific UI elements (selection, cursor, etc.)
  clone.querySelectorAll('.ProseMirror-selectednode').forEach((el) => {
    el.classList.remove('ProseMirror-selectednode');
  });

  // Remove contenteditable attributes
  clone.removeAttribute('contenteditable');
  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });

  // Remove any tippy/tooltip elements
  clone.querySelectorAll('[data-tippy-root]').forEach((el) => el.remove());

  // Remove slash command menu if present
  clone.querySelectorAll('.slash-command-menu').forEach((el) => el.remove());

  // Remove any drag handles or block menus
  clone.querySelectorAll('.block-menu, .drag-handle').forEach((el) => el.remove());

  return clone.innerHTML;
}

/**
 * Convert HSL CSS variable value to actual HSL color
 */
function resolveHslVar(value: string): string {
  if (!value) return '';
  // If it's already a color value, return as-is
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl(')) {
    return value;
  }
  // HSL values from CSS variables are in format "H S% L%" or "H S% L% / A"
  const trimmed = value.trim();
  if (trimmed.includes('/')) {
    // Has alpha: "0 0% 98% / 0.5" -> "hsla(0, 0%, 98%, 0.5)"
    const [hsl, alpha] = trimmed.split('/').map((s) => s.trim());
    const [h, s, l] = hsl.split(/\s+/);
    return `hsla(${h}, ${s}, ${l}, ${alpha})`;
  }
  // No alpha: "0 0% 98%" -> "hsl(0, 0%, 98%)"
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 3) {
    return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return value;
}

/**
 * Extract critical CSS from the current document for PDF export.
 * Gets computed styles and resolves CSS variables to actual color values.
 */
export function getExportCSS(): string {
  // Get CSS custom properties from :root
  const rootStyles = getComputedStyle(document.documentElement);

  // Helper to get and resolve CSS variable
  const getVar = (name: string, fallback: string): string => {
    const value = rootStyles.getPropertyValue(name).trim();
    return value || fallback;
  };

  // Resolve HSL variables to actual colors for PDF export
  const background = resolveHslVar(getVar('--background', '0 0% 98%'));
  const foreground = resolveHslVar(getVar('--foreground', '0 0% 12%'));
  const muted = resolveHslVar(getVar('--muted', '0 0% 94%'));
  const mutedForeground = resolveHslVar(getVar('--muted-foreground', '0 0% 45%'));
  const border = resolveHslVar(getVar('--border', '0 0% 85%'));
  const primary = resolveHslVar(getVar('--primary', '211 100% 50%'));
  const accent = resolveHslVar(getVar('--accent', '211 100% 95%'));
  const accentForeground = resolveHslVar(getVar('--accent-foreground', '211 100% 35%'));
  const card = resolveHslVar(getVar('--card', '0 0% 100%'));

  // Code colors
  const codeBg = resolveHslVar(getVar('--code-bg', '0 0% 96%'));
  const codeText = resolveHslVar(getVar('--code-text', '0 0% 18%'));
  const codeKeyword = resolveHslVar(getVar('--code-keyword', '262 60% 50%'));
  const codeString = resolveHslVar(getVar('--code-string', '142 60% 40%'));
  const codeNumber = resolveHslVar(getVar('--code-number', '28 80% 50%'));
  const codeFunction = resolveHslVar(getVar('--code-function', '211 100% 45%'));
  const codeComment = resolveHslVar(getVar('--code-comment', '0 0% 55%'));
  const codeVariable = resolveHslVar(getVar('--code-variable', '0 0% 30%'));
  const codeType = resolveHslVar(getVar('--code-type', '45 80% 45%'));
  const codeOperator = resolveHslVar(getVar('--code-operator', '180 40% 45%'));
  const codePunctuation = resolveHslVar(getVar('--code-punctuation', '0 0% 45%'));
  const codeAttribute = resolveHslVar(getVar('--code-attribute', '330 60% 50%'));
  const codeTag = resolveHslVar(getVar('--code-tag', '211 80% 45%'));
  const codeProperty = resolveHslVar(getVar('--code-property', '262 50% 50%'));

  // Font values (these are strings, not HSL)
  const fontEditorBody = getVar('--font-editor-body', "'Barlow', 'Inter', sans-serif");
  const fontEditorHeading = getVar(
    '--font-editor-heading',
    "'Barlow Semi Condensed', 'Inter', sans-serif",
  );
  const fontMono = getVar('--font-mono', "'Fira Code', monospace");
  const fontEditorSize = getVar('--font-editor-size', '16px');
  const fontEditorLineHeight = getVar('--font-editor-line-height', '1.65');

  // Export resolved CSS variables for the PDF
  const cssVars = `
    :root {
      /* Resolved colors */
      --background: ${background};
      --foreground: ${foreground};
      --muted: ${muted};
      --muted-foreground: ${mutedForeground};
      --border: ${border};
      --primary: ${primary};
      --accent: ${accent};
      --accent-foreground: ${accentForeground};
      --card: ${card};

      /* Font variables */
      --font-editor-body: ${fontEditorBody};
      --font-editor-heading: ${fontEditorHeading};
      --font-mono: ${fontMono};
      --font-editor-size: ${fontEditorSize};
      --font-editor-line-height: ${fontEditorLineHeight};

      /* Code colors - resolved */
      --code-bg: ${codeBg};
      --code-text: ${codeText};
      --code-keyword: ${codeKeyword};
      --code-string: ${codeString};
      --code-number: ${codeNumber};
      --code-function: ${codeFunction};
      --code-comment: ${codeComment};
      --code-variable: ${codeVariable};
      --code-type: ${codeType};
      --code-operator: ${codeOperator};
      --code-punctuation: ${codePunctuation};
      --code-attribute: ${codeAttribute};
      --code-tag: ${codeTag};
      --code-property: ${codeProperty};
    }
  `;

  return cssVars;
}

/**
 * Get all stylesheet rules from the document that are relevant for export
 */
export function getDocumentStyles(): string {
  const styles: string[] = [];

  // Collect all stylesheets
  for (const sheet of document.styleSheets) {
    try {
      // Skip external stylesheets we can't access
      if (!sheet.cssRules) continue;

      for (const rule of sheet.cssRules) {
        const ruleText = rule.cssText;

        // Include rules that are relevant for the editor content
        if (
          ruleText.includes('.prose') ||
          ruleText.includes('.ProseMirror') ||
          ruleText.includes('.hljs') ||
          ruleText.includes('.mermaid') ||
          ruleText.includes('.code-block') ||
          ruleText.includes('.task-') ||
          ruleText.includes('.note-link') ||
          ruleText.includes('.stone-table') ||
          ruleText.includes('--code-') ||
          ruleText.includes('--font-') ||
          ruleText.includes('h1') ||
          ruleText.includes('h2') ||
          ruleText.includes('h3') ||
          ruleText.includes('blockquote') ||
          ruleText.includes('pre') ||
          ruleText.includes('code')
        ) {
          styles.push(ruleText);
        }
      }
    } catch {
      // CORS errors for external stylesheets - skip
      continue;
    }
  }

  return styles.join('\n');
}

/**
 * Build complete HTML for PDF export with pre-rendered content
 */
export function buildExportHTML(
  title: string,
  renderedContent: string,
  customCSS: string = '',
): string {
  const cssVars = getExportCSS();
  const docStyles = getDocumentStyles();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!-- Google Fonts for PDF export -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS_URL}" rel="stylesheet">
  <style>
    /* CSS Variables from app - resolved to actual values */
    ${cssVars}

    /* Document styles from app */
    ${docStyles}

    /* Base export styles */
    * { box-sizing: border-box; }

    body {
      font-family: 'Barlow', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: var(--font-editor-size, 16px);
      line-height: var(--font-editor-line-height, 1.65);
      color: var(--foreground);
      background: white;
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 64px;
      -webkit-font-smoothing: antialiased;
    }

    /* Headings use Barlow Semi Condensed */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Barlow Semi Condensed', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 700;
      color: var(--foreground);
    }

    h1 { font-size: 2.5em; margin-top: 1.5em; margin-bottom: 0.5em; }
    h2 { font-size: 2em; margin-top: 1.25em; margin-bottom: 0.5em; }
    h3 { font-size: 1.5em; margin-top: 1em; margin-bottom: 0.5em; }
    h4 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.5em; }

    /* Export title - the note title at the top */
    h1.export-title {
      margin-top: 0;
      margin-bottom: 1.5em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid var(--border);
    }

    p {
      margin: 1em 0;
      color: var(--foreground);
    }

    /* Ensure SVGs (Mermaid diagrams) display correctly */
    svg {
      max-width: 100%;
      height: auto;
    }

    .mermaid-preview {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5rem;
      background: var(--card, #ffffff);
    }

    .mermaid-preview svg {
      display: block;
      margin: 0 auto;
    }

    /* Mermaid diagrams use Patrick Hand font */
    .mermaid-preview,
    .mermaid-preview svg text,
    .mermaid-preview .nodeLabel,
    .mermaid-preview .edgeLabel,
    .mermaid-preview .label,
    .mermaid-preview .label text {
      font-family: 'Patrick Hand', 'Bradley Hand', cursive !important;
    }

    /* Ensure code blocks are styled */
    pre, .hljs {
      font-family: 'Fira Code', 'SF Mono', Monaco, monospace !important;
      background: var(--code-bg) !important;
      color: var(--code-text) !important;
      padding: 24px !important;
      border-radius: 8px !important;
      overflow-x: auto;
      font-size: 14px;
      line-height: 1.7;
    }

    code {
      font-family: 'Fira Code', 'SF Mono', Monaco, monospace;
    }

    /* Inline code */
    :not(pre) > code {
      background: var(--muted);
      color: var(--foreground);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
    }

    /* Syntax highlighting */
    .hljs-keyword { color: var(--code-keyword); font-weight: 500; }
    .hljs-string { color: var(--code-string); }
    .hljs-number { color: var(--code-number); }
    .hljs-title, .hljs-title.function_ { color: var(--code-function); font-weight: 500; }
    .hljs-comment { color: var(--code-comment); font-style: italic; }
    .hljs-variable { color: var(--code-variable); }
    .hljs-type, .hljs-built_in { color: var(--code-type); }
    .hljs-operator { color: var(--code-operator); }
    .hljs-punctuation { color: var(--code-punctuation); }
    .hljs-attr, .hljs-attribute { color: var(--code-attribute); }
    .hljs-tag, .hljs-name { color: var(--code-tag); }
    .hljs-property { color: var(--code-property); }

    /* Lists */
    ul, ol {
      padding-left: 1.5em;
      margin: 1em 0;
    }

    li {
      margin: 0.25em 0;
    }

    /* Task list - remove default list styling */
    .task-list {
      list-style: none !important;
      padding-left: 0 !important;
      margin: 0.5em 0 !important;
    }

    /* Task list items - inline-block for reliable inline layout */
    .task-item {
      display: block !important;
      padding: 0.2rem 0 !important;
      margin-bottom: 0.2rem !important;
      list-style: none !important;
      white-space: nowrap !important;
    }

    /* Task state button/badge - inline with text */
    .task-state-button {
      display: inline-block !important;
      vertical-align: middle !important;
      padding: 0.15rem 0.5rem !important;
      min-width: 2.8rem !important;
      font-size: 0.55rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
      text-align: center !important;
      border-radius: 9999px !important;
      border: 1px solid hsl(0, 0%, 85%) !important;
      background-color: white !important;
      color: hsl(0, 0%, 45%) !important;
      margin-right: 0.6rem !important;
    }

    /* TODO state - dashed border */
    .task-item[data-state='todo'] .task-state-button {
      border-style: dashed !important;
    }

    /* DOING state */
    .task-item[data-state='doing'] .task-state-button {
      background-color: hsl(211, 100%, 95%) !important;
      border-color: hsl(211, 100%, 50%) !important;
      border-style: solid !important;
      color: hsl(211, 100%, 50%) !important;
    }

    /* DONE state - solid blue */
    .task-item[data-state='done'] .task-state-button {
      background-color: hsl(211, 100%, 50%) !important;
      border-color: hsl(211, 100%, 50%) !important;
      border-style: solid !important;
      color: white !important;
    }

    /* WAIT state */
    .task-item[data-state='waiting'] .task-state-button {
      background-color: white !important;
      border-color: hsl(211, 100%, 50%) !important;
      border-style: solid !important;
      color: hsl(211, 100%, 50%) !important;
    }

    /* HOLD state - dashed gray */
    .task-item[data-state='hold'] .task-state-button {
      border-style: dashed !important;
      background-color: hsl(0, 0%, 96%) !important;
      border-color: hsl(0, 0%, 70%) !important;
      color: hsl(0, 0%, 45%) !important;
    }

    /* CANCELED state - red */
    .task-item[data-state='canceled'] .task-state-button {
      border-style: solid !important;
      background-color: hsl(0, 84%, 95%) !important;
      border-color: hsl(0, 84%, 60%) !important;
      color: hsl(0, 84%, 60%) !important;
    }

    /* IDEA state */
    .task-item[data-state='idea'] .task-state-button {
      background-color: white !important;
      border-color: hsl(211, 100%, 50%) !important;
      border-style: solid !important;
      color: hsl(211, 100%, 50%) !important;
    }

    /* Task content - inline */
    .task-item > div {
      display: inline !important;
      vertical-align: middle !important;
      white-space: normal !important;
    }

    /* Done/canceled tasks - strikethrough */
    .task-item[data-state='done'] > div,
    .task-item[data-state='canceled'] > div {
      text-decoration: line-through !important;
      color: hsl(0, 0%, 45%) !important;
    }

    /* Blockquote */
    blockquote {
      border-left: 4px solid var(--border);
      margin: 1em 0;
      padding-left: 1em;
      color: var(--muted-foreground);
      font-style: italic;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 0.5em 1em;
      text-align: left;
    }

    th {
      background: var(--muted);
      font-weight: 600;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    /* Links */
    a {
      color: var(--primary);
      text-decoration: none;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2em 0;
    }

    /* Code block wrapper */
    .code-block-wrapper {
      margin: 1em 0;
      border-radius: 8px;
      overflow: hidden;
    }

    /* Print optimizations */
    @media print {
      body { padding: 24px 36px; }
      pre { white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
      img { page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      .mermaid-preview { page-break-inside: avoid; }
      .code-block-wrapper { page-break-inside: avoid; }
    }

    ${customCSS}
  </style>
</head>
<body>
  <div class="prose prose-stone content">
    <h1 class="export-title">${escapeHtml(title)}</h1>
    ${renderedContent}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
