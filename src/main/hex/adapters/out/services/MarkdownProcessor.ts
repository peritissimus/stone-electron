/**
 * Markdown Processor Adapter
 *
 * Implements IMarkdownProcessor port wrapping existing MarkdownService.
 */

import type {
  IMarkdownProcessor,
  MarkdownMetadata,
  ParsedMarkdown,
} from '../../../domain/ports/out/IMarkdownProcessor';
import { getMarkdownService } from '@main/services/MarkdownService';

export class MarkdownProcessor implements IMarkdownProcessor {
  private readonly service = getMarkdownService();

  htmlToMarkdown(html: string): string {
    return this.service.htmlToMarkdown(html);
  }

  async markdownToHtml(markdown: string): Promise<string> {
    return this.service.markdownToHtml(markdown);
  }

  parseFrontmatter(markdown: string): ParsedMarkdown {
    // Basic frontmatter parsing - service may not have this
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatterMatch) {
      return { content: markdown, metadata: {} };
    }

    const frontmatter = frontmatterMatch[1];
    const content = markdown.slice(frontmatterMatch[0].length);
    const metadata: MarkdownMetadata = {};

    // Simple YAML-like parsing
    for (const line of frontmatter.split('\n')) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        metadata[key.trim()] = value;
      }
    }

    return { content, metadata };
  }

  updateFrontmatter(markdown: string, metadata: MarkdownMetadata): string {
    const parsed = this.parseFrontmatter(markdown);
    const mergedMetadata = { ...parsed.metadata, ...metadata };

    const frontmatterLines = Object.entries(mergedMetadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `---\n${frontmatterLines}\n---\n${parsed.content}`;
  }

  extractTitle(markdown: string): string | null {
    // Try frontmatter first
    const parsed = this.parseFrontmatter(markdown);
    if (parsed.metadata.title) {
      return String(parsed.metadata.title);
    }

    // Try first H1
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1] : null;
  }

  extractPlainText(markdown: string): string {
    // Simple markdown stripping
    return markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Replace links with text
      .replace(/[#*_~`]/g, '') // Remove markdown symbols
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
  }

  extractLinks(markdown: string): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      links.push({ text: match[1], href: match[2] });
    }

    return links;
  }

  extractWikiLinks(markdown: string): string[] {
    const wikiLinks: string[] = [];
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(markdown)) !== null) {
      wikiLinks.push(match[1]);
    }

    return wikiLinks;
  }

  htmlToPlainText(html: string): string {
    // Convert HTML to markdown first, then strip
    const markdown = this.htmlToMarkdown(html);
    return this.extractPlainText(markdown);
  }
}
