/**
 * LinkExtractor - Pure domain service for extracting links from markdown
 *
 * Handles wiki-style links [[Note Title]] and standard markdown links [text](url)
 */

/**
 * Types of links found in markdown
 */
export type LinkType = 'wiki' | 'markdown' | 'url';

/**
 * Extracted link from markdown content
 */
export interface ExtractedLink {
  type: LinkType;
  target: string; // The link target (note title for wiki, path for markdown, URL for external)
  text: string; // Display text
  lineNumber: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Wiki-link pattern: [[Note Title]] or [[Note Title|Display Text]]
 */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Markdown link pattern: [text](url)
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * URL pattern for detecting external links
 */
const URL_PATTERN = /^https?:\/\//i;

/**
 * LinkExtractor - Pure functions for link extraction
 */
export const LinkExtractor = {
  /**
   * Extract wiki-style links [[Note Title]]
   */
  extractWikiLinks(markdown: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const lines = markdown.split('\n');
    let charOffset = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const pattern = new RegExp(WIKI_LINK_PATTERN.source, WIKI_LINK_PATTERN.flags);

      let match;
      while ((match = pattern.exec(line)) !== null) {
        const target = match[1].trim();
        const displayText = match[2]?.trim() || target;

        links.push({
          type: 'wiki',
          target,
          text: displayText,
          lineNumber: lineNum + 1,
          startIndex: charOffset + match.index,
          endIndex: charOffset + match.index + match[0].length,
        });
      }

      charOffset += line.length + 1; // +1 for newline
    }

    return links;
  },

  /**
   * Extract standard markdown links [text](url)
   */
  extractMarkdownLinks(markdown: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const lines = markdown.split('\n');
    let charOffset = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const pattern = new RegExp(MARKDOWN_LINK_PATTERN.source, MARKDOWN_LINK_PATTERN.flags);

      let match;
      while ((match = pattern.exec(line)) !== null) {
        const text = match[1].trim();
        const target = match[2].trim();
        const isExternal = URL_PATTERN.test(target);

        links.push({
          type: isExternal ? 'url' : 'markdown',
          target,
          text,
          lineNumber: lineNum + 1,
          startIndex: charOffset + match.index,
          endIndex: charOffset + match.index + match[0].length,
        });
      }

      charOffset += line.length + 1;
    }

    return links;
  },

  /**
   * Extract all links (wiki + markdown)
   */
  extractAllLinks(markdown: string): ExtractedLink[] {
    const wikiLinks = this.extractWikiLinks(markdown);
    const markdownLinks = this.extractMarkdownLinks(markdown);

    // Combine and sort by position
    return [...wikiLinks, ...markdownLinks].sort((a, b) => a.startIndex - b.startIndex);
  },

  /**
   * Extract only internal note links (wiki + local markdown links)
   */
  extractInternalLinks(markdown: string): ExtractedLink[] {
    return this.extractAllLinks(markdown).filter(
      (link) => link.type === 'wiki' || link.type === 'markdown'
    );
  },

  /**
   * Get unique note titles referenced in the content
   */
  getReferencedNoteTitles(markdown: string): string[] {
    const internalLinks = this.extractInternalLinks(markdown);
    const titles = new Set<string>();

    for (const link of internalLinks) {
      if (link.type === 'wiki') {
        titles.add(link.target);
      } else if (link.type === 'markdown' && !link.target.startsWith('/')) {
        // For markdown links, extract filename without extension
        const filename = link.target.split('/').pop()?.replace(/\.md$/i, '');
        if (filename) {
          titles.add(filename);
        }
      }
    }

    return Array.from(titles);
  },

  /**
   * Check if content contains a link to a specific note
   */
  hasLinkTo(markdown: string, noteTitle: string): boolean {
    const titles = this.getReferencedNoteTitles(markdown);
    const normalizedTarget = noteTitle.toLowerCase();
    return titles.some((t) => t.toLowerCase() === normalizedTarget);
  },
};
