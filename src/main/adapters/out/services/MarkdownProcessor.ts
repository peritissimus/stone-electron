/**
 * Markdown Processor Adapter
 *
 * Implements IMarkdownProcessor port using the infrastructure MarkdownService.
 */

import { getMarkdownService } from '../../../infrastructure';
import type {
  IMarkdownProcessor,
  MarkdownMetadata,
  ParsedMarkdown,
} from '../../../domain';

export class MarkdownProcessor implements IMarkdownProcessor {
  private readonly service = getMarkdownService();

  htmlToMarkdown(html: string): string {
    return this.service.htmlToMarkdown(html);
  }

  async markdownToHtml(markdown: string): Promise<string> {
    return this.service.markdownToHtml(markdown);
  }

  parseFrontmatter(markdown: string): ParsedMarkdown {
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
    return this.service.extractTitle(markdown) || null;
  }

  extractPlainText(markdown: string): string {
    return this.service.htmlToPlainText(markdown);
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
    return this.service.htmlToPlainText(html);
  }
}
