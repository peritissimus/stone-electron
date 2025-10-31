/**
 * MarkdownService - Converts between HTML and Markdown formats
 */

import TurndownService from 'turndown';
import { marked } from 'marked';

export class MarkdownService {
  private turndownService: TurndownService;

  constructor() {
    // Initialize Turndown service for HTML -> Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
    });

    // Add custom rules for better conversion
    this.addCustomRules();
  }

  /**
   * Convert HTML to Markdown
   */
  htmlToMarkdown(html: string): string {
    if (!html || html.trim() === '') {
      return '';
    }

    try {
      return this.turndownService.turndown(html);
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      return html; // Return original if conversion fails
    }
  }

  /**
   * Convert Markdown to HTML
   */
  async markdownToHtml(markdown: string): Promise<string> {
    if (!markdown || markdown.trim() === '') {
      return '';
    }

    try {
      // Configure marked options
      marked.setOptions({
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // Convert \n to <br>
      });

      return await marked.parse(markdown);
    } catch (error) {
      console.error('Error converting Markdown to HTML:', error);
      return markdown; // Return original if conversion fails
    }
  }

  /**
   * Add custom Turndown rules
   */
  private addCustomRules(): void {
    // Preserve highlight spans
    this.turndownService.addRule('highlight', {
      filter: (node) => {
        return (
          node.nodeName === 'MARK' ||
          (node.nodeName === 'SPAN' &&
            node.classList &&
            node.classList.contains('bg-accent'))
        );
      },
      replacement: (content) => {
        return `==${content}==`; // Use standard highlight syntax
      },
    });

    // Handle code blocks with language
    this.turndownService.addRule('fencedCodeBlock', {
      filter: (node, options): boolean => {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild !== null &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: (content, node, options) => {
        const codeElement = node.firstChild as HTMLElement;
        const className = codeElement.className || '';
        const language = className.replace('language-', '').replace('code-block', '').trim();

        const code = codeElement.textContent || '';
        const fence = options.fence || '```';

        return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
      },
    });
  }

  /**
   * Sanitize filename from title
   */
  sanitizeFilename(title: string): string {
    return title
      .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Generate filename from title
   */
  generateFilename(title: string, extension: string = '.md'): string {
    const sanitized = this.sanitizeFilename(title || 'Untitled');
    return `${sanitized}${extension}`;
  }

  /**
   * Extract title from markdown content (first heading or first line)
   */
  extractTitle(markdown: string): string {
    if (!markdown || markdown.trim() === '') {
      return 'Untitled';
    }

    const lines = markdown.split('\n');

    // Look for first heading
    for (const line of lines) {
      const headingMatch = line.match(/^#+\s+(.+)$/);
      if (headingMatch) {
        return headingMatch[1].trim();
      }
    }

    // Fall back to first non-empty line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed !== '') {
        return trimmed.substring(0, 100); // Limit to 100 chars
      }
    }

    return 'Untitled';
  }
}

// Singleton instance
let instance: MarkdownService | null = null;

/**
 * Get or create markdown service instance
 */
export function getMarkdownService(): MarkdownService {
  if (!instance) {
    instance = new MarkdownService();
  }
  return instance;
}
