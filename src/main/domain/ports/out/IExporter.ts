/**
 * Export Service Port - Outbound interface for rendering exports
 */

/**
 * PDF generation options
 */
export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  landscape?: boolean;
  printBackground?: boolean;
}

/**
 * HTML template options
 */
export interface HtmlOptions {
  title?: string;
  theme?: 'light' | 'dark';
  includeStyles?: boolean;
  customCss?: string;
}

/**
 * Export Service - Handles rendering to various formats
 */
export interface IExporter {
  /**
   * Render HTML content to PDF
   */
  renderToPdf(html: string, options?: PdfOptions): Promise<Buffer>;

  /**
   * Generate complete HTML document from content
   */
  generateHtmlDocument(content: string, options?: HtmlOptions): string;

  /**
   * Check if PDF export is available
   */
  isPdfAvailable(): boolean;
}
