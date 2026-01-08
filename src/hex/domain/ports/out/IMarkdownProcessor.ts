/**
 * Markdown Processor Port (Outbound)
 *
 * Defines the contract for markdown conversion operations.
 */

export interface MarkdownMetadata {
  title?: string;
  tags?: string[];
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

export interface ParsedMarkdown {
  content: string;
  metadata: MarkdownMetadata;
}

export interface IMarkdownProcessor {
  /**
   * Convert HTML to Markdown
   */
  htmlToMarkdown(html: string): string;

  /**
   * Convert Markdown to HTML
   */
  markdownToHtml(markdown: string): Promise<string>;

  /**
   * Parse frontmatter from markdown content
   */
  parseFrontmatter(markdown: string): ParsedMarkdown;

  /**
   * Add/update frontmatter in markdown content
   */
  updateFrontmatter(markdown: string, metadata: MarkdownMetadata): string;

  /**
   * Extract title from markdown content (first H1 or frontmatter title)
   */
  extractTitle(markdown: string): string | null;

  /**
   * Extract plain text from markdown (strip formatting)
   */
  extractPlainText(markdown: string): string;

  /**
   * Extract links from markdown content
   */
  extractLinks(markdown: string): Array<{ text: string; href: string }>;

  /**
   * Extract wiki-style links [[link]] from markdown
   */
  extractWikiLinks(markdown: string): string[];

  /**
   * Convert HTML to plain text (strip all formatting)
   */
  htmlToPlainText(html: string): string;
}
