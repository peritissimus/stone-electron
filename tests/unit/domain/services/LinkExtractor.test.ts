/**
 * LinkExtractor Domain Service Tests
 *
 * Pure function tests - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { LinkExtractor } from '../../../../src/main/domain/services/LinkExtractor';

describe('LinkExtractor', () => {
  describe('extractWikiLinks', () => {
    it('extracts simple wiki links', () => {
      const markdown = 'Check out [[My Note]] for more info';
      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        target: 'My Note',
        text: 'My Note',
        type: 'wiki',
      });
    });

    it('extracts wiki links with display text', () => {
      const markdown = 'See [[Target Note|click here]] for details';
      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        target: 'Target Note',
        text: 'click here',
        type: 'wiki',
      });
    });

    it('extracts multiple wiki links', () => {
      const markdown = '[[First]] and [[Second]] and [[Third]]';
      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links).toHaveLength(3);
      expect(links.map((l) => l.target)).toEqual(['First', 'Second', 'Third']);
    });

    it('tracks position of links', () => {
      const markdown = '[[First]] then [[Second]]';
      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links[0].startIndex).toBe(0);
      expect(links[1].startIndex).toBeGreaterThan(links[0].startIndex);
    });

    it('returns empty array for no wiki links', () => {
      const markdown = 'No wiki links here';
      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links).toEqual([]);
    });

    it('handles multiline content', () => {
      const markdown = `
Line 1 with [[Link One]]
Line 2 with [[Link Two]]
      `.trim();

      const links = LinkExtractor.extractWikiLinks(markdown);

      expect(links).toHaveLength(2);
    });
  });

  describe('extractMarkdownLinks', () => {
    it('extracts markdown links', () => {
      const markdown = 'Click [here](https://example.com) for more';
      const links = LinkExtractor.extractMarkdownLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        target: 'https://example.com',
        text: 'here',
        type: 'url',
      });
    });

    it('identifies internal markdown file links', () => {
      const markdown = 'See [my note](./notes/note.md)';
      const links = LinkExtractor.extractMarkdownLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('markdown');
    });

    it('extracts multiple markdown links', () => {
      const markdown = '[One](url1) and [Two](url2)';
      const links = LinkExtractor.extractMarkdownLinks(markdown);

      expect(links).toHaveLength(2);
    });

    it('returns empty array for no markdown links', () => {
      const markdown = 'No links here';
      const links = LinkExtractor.extractMarkdownLinks(markdown);

      expect(links).toEqual([]);
    });
  });

  describe('extractAllLinks', () => {
    it('combines wiki and markdown links', () => {
      const markdown = '[[Wiki Link]] and [Markdown](https://url.com)';
      const links = LinkExtractor.extractAllLinks(markdown);

      expect(links).toHaveLength(2);
      expect(links.some((l) => l.type === 'wiki')).toBe(true);
      expect(links.some((l) => l.type === 'url')).toBe(true);
    });

    it('sorts links by position', () => {
      const markdown = '[First](url) then [[Second]] then [Third](url2)';
      const links = LinkExtractor.extractAllLinks(markdown);

      expect(links).toHaveLength(3);
      // Should be sorted by startIndex
      for (let i = 1; i < links.length; i++) {
        expect(links[i].startIndex).toBeGreaterThanOrEqual(links[i - 1].startIndex);
      }
    });
  });

  describe('extractInternalLinks', () => {
    it('filters out external URLs', () => {
      const markdown = '[[Internal]] and [External](https://google.com)';
      const links = LinkExtractor.extractInternalLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('wiki');
    });

    it('includes wiki links', () => {
      const markdown = '[[Note One]] [[Note Two]]';
      const links = LinkExtractor.extractInternalLinks(markdown);

      expect(links).toHaveLength(2);
    });

    it('includes relative markdown links', () => {
      const markdown = '[Local](./local.md) and [External](https://url.com)';
      const links = LinkExtractor.extractInternalLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('markdown');
    });
  });

  describe('getReferencedNoteTitles', () => {
    it('returns unique array of referenced note titles', () => {
      const markdown = '[[Note A]] and [[Note B]] and [[Note A]] again';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(Array.isArray(titles)).toBe(true);
      expect(titles).toHaveLength(2);
      expect(titles).toContain('Note A');
      expect(titles).toContain('Note B');
    });

    it('returns empty array for no links', () => {
      const markdown = 'No links here';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(titles).toHaveLength(0);
    });
  });

  describe('hasLinkTo', () => {
    it('returns true when link exists', () => {
      const markdown = 'Check [[My Note]] for info';

      expect(LinkExtractor.hasLinkTo(markdown, 'My Note')).toBe(true);
    });

    it('returns false when link does not exist', () => {
      const markdown = 'Check [[Other Note]] for info';

      expect(LinkExtractor.hasLinkTo(markdown, 'My Note')).toBe(false);
    });

    it('is case insensitive', () => {
      const markdown = '[[My Note]]';

      expect(LinkExtractor.hasLinkTo(markdown, 'my note')).toBe(true);
      expect(LinkExtractor.hasLinkTo(markdown, 'MY NOTE')).toBe(true);
    });

    it('returns false for empty content', () => {
      expect(LinkExtractor.hasLinkTo('', 'Note')).toBe(false);
    });
  });

  describe('getReferencedNoteTitles', () => {
    it('extracts titles from wiki links', () => {
      const markdown = '[[My Note]] and [[Another Note]]';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(titles).toContain('My Note');
      expect(titles).toContain('Another Note');
    });

    it('extracts titles from relative markdown links', () => {
      const markdown = 'Check [link](notes/my-note.md) and [other](folder/other-note.md)';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(titles).toContain('my-note');
      expect(titles).toContain('other-note');
    });

    it('ignores absolute path markdown links', () => {
      const markdown = 'See [external](/absolute/path.md)';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(titles).not.toContain('path');
    });

    it('returns unique titles', () => {
      const markdown = '[[Note]] and [[Note]] again';
      const titles = LinkExtractor.getReferencedNoteTitles(markdown);

      expect(titles).toHaveLength(1);
      expect(titles[0]).toBe('Note');
    });
  });
});
