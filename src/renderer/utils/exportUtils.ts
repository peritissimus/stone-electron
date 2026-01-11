/**
 * Export Utilities - Capture pre-rendered editor content for PDF/HTML export
 */

import { Editor } from '@tiptap/react';

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
 * Extract critical CSS from the current document for PDF export.
 * Gets computed styles for common elements to ensure PDF matches editor.
 */
export function getExportCSS(): string {
  // Get CSS custom properties from :root
  const rootStyles = getComputedStyle(document.documentElement);

  // Extract key CSS variables
  const cssVars = `
    :root {
      --background: ${rootStyles.getPropertyValue('--background').trim() || '#ffffff'};
      --foreground: ${rootStyles.getPropertyValue('--foreground').trim() || '#1f1f1f'};
      --muted: ${rootStyles.getPropertyValue('--muted').trim() || '#f0f0f0'};
      --muted-foreground: ${rootStyles.getPropertyValue('--muted-foreground').trim() || '#737373'};
      --border: ${rootStyles.getPropertyValue('--border').trim() || '#d9d9d9'};
      --primary: ${rootStyles.getPropertyValue('--primary').trim() || '#0080ff'};
      --accent: ${rootStyles.getPropertyValue('--accent').trim() || '#e6f3ff'};
      --accent-foreground: ${rootStyles.getPropertyValue('--accent-foreground').trim() || '#0059b3'};

      /* Font variables */
      --font-editor-body: ${rootStyles.getPropertyValue('--font-editor-body').trim() || "'Barlow', 'Inter', sans-serif"};
      --font-editor-heading: ${rootStyles.getPropertyValue('--font-editor-heading').trim() || "'Barlow Semi Condensed', 'Inter', sans-serif"};
      --font-mono: ${rootStyles.getPropertyValue('--font-mono').trim() || "'Fira Code', monospace"};
      --font-editor-size: ${rootStyles.getPropertyValue('--font-editor-size').trim() || '16px'};
      --font-editor-line-height: ${rootStyles.getPropertyValue('--font-editor-line-height').trim() || '1.65'};

      /* Code colors */
      --code-bg: ${rootStyles.getPropertyValue('--code-bg').trim() || '#f5f5f5'};
      --code-text: ${rootStyles.getPropertyValue('--code-text').trim() || '#2e2e2e'};
      --code-keyword: ${rootStyles.getPropertyValue('--code-keyword').trim() || '#7c3aed'};
      --code-string: ${rootStyles.getPropertyValue('--code-string').trim() || '#16a34a'};
      --code-number: ${rootStyles.getPropertyValue('--code-number').trim() || '#ea580c'};
      --code-function: ${rootStyles.getPropertyValue('--code-function').trim() || '#0066cc'};
      --code-comment: ${rootStyles.getPropertyValue('--code-comment').trim() || '#8c8c8c'};
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
  <style>
    /* CSS Variables from app */
    ${cssVars}

    /* Document styles from app */
    ${docStyles}

    /* Base export styles */
    * { box-sizing: border-box; }

    body {
      font-family: var(--font-editor-body);
      font-size: var(--font-editor-size);
      line-height: var(--font-editor-line-height);
      color: hsl(var(--foreground));
      background: white;
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 64px;
      -webkit-font-smoothing: antialiased;
    }

    /* Ensure SVGs (Mermaid diagrams) display correctly */
    svg {
      max-width: 100%;
      height: auto;
    }

    .mermaid svg {
      display: block;
      margin: 0 auto;
    }

    /* Ensure code blocks are styled */
    pre, .hljs {
      font-family: var(--font-mono) !important;
      background: hsl(var(--code-bg)) !important;
      color: hsl(var(--code-text)) !important;
      padding: 24px !important;
      border-radius: 8px !important;
      overflow-x: auto;
    }

    code {
      font-family: var(--font-mono);
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    /* Print optimizations */
    @media print {
      body { padding: 24px 36px; }
      pre { white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
      img { page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      .mermaid { page-break-inside: avoid; }
    }

    ${customCSS}
  </style>
</head>
<body>
  <div class="prose prose-stone content">
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
