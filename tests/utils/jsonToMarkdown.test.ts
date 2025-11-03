import { describe, it, expect } from 'vitest';
import { jsonToMarkdown } from '@/renderer/utils/jsonToMarkdown';

describe('jsonToMarkdown table conversion', () => {
  it('flattens multi-paragraph table cells into single line markdown', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header 1' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header 2' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'First line' }],
                    },
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Second line' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Simple cell' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const markdown = jsonToMarkdown(doc);
    const lines = markdown.trim().split('\n');

    expect(lines[0]).toBe('| Header 1 | Header 2 |');
    expect(lines[1]).toBe('| --- | --- |');
    expect(lines[2]).toBe('| First line Second line | Simple cell |');
  });

  it('converts hard breaks to spaces and preserves inline marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
                        { type: 'text', text: ' text' },
                        { type: 'hardBreak' },
                        {
                          type: 'text',
                          text: 'Link',
                          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                        },
                        { type: 'text', text: ' end' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const markdown = jsonToMarkdown(doc);
    const lines = markdown.trim().split('\n');

    expect(lines[0]).toBe('| Header |');
    expect(lines[1]).toBe('| --- |');
    expect(lines[2]).toBe('| **Bold** text [Link](https://example.com) end |');
  });
});
