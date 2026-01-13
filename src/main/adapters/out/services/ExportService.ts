/**
 * Export Service Adapter - Renders notes to various export formats
 */

import type { BrowserWindow } from 'electron';
import type { IExportService, PdfOptions, HtmlOptions } from '../../../domain';
import { logger } from '../../../shared';

/**
 * Export Service implementation
 * Note: PDF export requires electron's printToPDF or a headless browser
 */
export class ExportService implements IExportService {
  private pdfAvailable: boolean = false;

  constructor() {
    // Check if we have PDF export capability
    try {
      // In Electron, we can use BrowserWindow.webContents.printToPDF
      const { BrowserWindow } = require('electron');
      this.pdfAvailable = !!BrowserWindow;
    } catch {
      this.pdfAvailable = false;
    }
  }

  async renderToPdf(html: string, options?: PdfOptions): Promise<Buffer> {
    return await logger.withContext('out:ExportService.renderToPdf', async () => {
      if (!this.pdfAvailable) {
        throw new Error('PDF export is not available in this environment');
      }

      let win: BrowserWindow | null = null;
      try {
        const { BrowserWindow } = require('electron');

        // Create a hidden window for rendering with web security enabled for font loading
        win = new BrowserWindow({
          show: false,
          width: 1200,
          height: 800,
          webPreferences: {
            offscreen: true,
            webSecurity: true, // Allow loading external resources (Google Fonts)
          },
        });

        if (!win) {
          throw new Error('Failed to create BrowserWindow for PDF export');
        }

        // Load the HTML content
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        // Wait for fonts to load - Google Fonts need more time
        // We wait for both DOMContentLoaded and font loading
        await win.webContents.executeJavaScript(`
          new Promise((resolve) => {
            // Wait for document ready and fonts
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(() => {
                // Additional delay for any remaining rendering
                setTimeout(resolve, 500);
              });
            } else {
              // Fallback: wait a fixed time if fonts API not available
              setTimeout(resolve, 2000);
            }
          });
        `);

        // Generate PDF with no margins (content has its own padding)
        const pdfBuffer = await win.webContents.printToPDF({
          margins: {
            marginType: 'none',
          },
          printBackground: options?.printBackground ?? true,
          landscape: options?.landscape ?? false,
          pageSize: options?.format || 'Letter',
        });

        win.close();

        logger.info('[ExportService] Generated PDF with fonts loaded');
        return Buffer.from(pdfBuffer);
      } catch (error) {
        logger.error('[ExportService] PDF generation failed:', error);
        throw error;
      } finally {
        if (win && !win.isDestroyed()) {
          win.destroy();
        }
      }
    });
  }

  generateHtmlDocument(content: string, options?: HtmlOptions): string {
    const title = options?.title || 'Exported Note';
    const theme = options?.theme || 'light';

    const styles = options?.includeStyles
      ? `
        <style>
          :root {
            --bg: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
            --fg: ${theme === 'dark' ? '#e5e5e5' : '#1a1a1a'};
            --muted: ${theme === 'dark' ? '#a3a3a3' : '#737373'};
            --border: ${theme === 'dark' ? '#404040' : '#e5e5e5'};
            --code-bg: ${theme === 'dark' ? '#262626' : '#f5f5f5'};
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.65;
            color: var(--fg);
            background: var(--bg);
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
          }

          h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
            line-height: 1.3;
          }

          h1 { font-size: 2.5em; }
          h2 { font-size: 2em; }
          h3 { font-size: 1.5em; }
          h4 { font-size: 1.25em; }

          p {
            margin: 1em 0;
          }

          a {
            color: #3b82f6;
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }

          code {
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.9em;
            background: var(--code-bg);
            padding: 0.2em 0.4em;
            border-radius: 4px;
          }

          pre {
            background: var(--code-bg);
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
          }

          pre code {
            background: none;
            padding: 0;
          }

          blockquote {
            border-left: 4px solid var(--border);
            margin: 1em 0;
            padding-left: 1em;
            color: var(--muted);
          }

          ul, ol {
            margin: 1em 0;
            padding-left: 2em;
          }

          li {
            margin: 0.5em 0;
          }

          hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 2em 0;
          }

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
            background: var(--code-bg);
            font-weight: 600;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          ${options?.customCss || ''}
        </style>
      `
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  ${content}
</body>
</html>`;
  }

  isPdfAvailable(): boolean {
    return this.pdfAvailable;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
