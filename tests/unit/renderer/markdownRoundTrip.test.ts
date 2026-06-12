/**
 * Markdown round-trip tests — the data-integrity contract for notes.
 *
 * Every save runs file → parseMarkdown → editor doc → serializeMarkdown →
 * file. If that loop drifts, notes silently corrupt on every open/save
 * cycle. The contract tested here:
 *
 *   1. CANONICAL: markdown already in the serializer's own style survives
 *      a round trip byte-for-byte (no information loss).
 *   2. IDEMPOTENT: arbitrary valid markdown may normalize ONCE
 *      (e.g. `* item` → `- item`, [9:30] → [09:30]), but a second pass
 *      must be byte-stable — normalize-then-fixpoint, never drift.
 *   3. STRUCTURE: custom inline nodes (task markers, timestamps, note
 *      links) parse to the exact node shapes the editor expects.
 */

import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { serializeMarkdown } from '@renderer/lib/markdownSerializer';

/** One file→editor→save cycle. */
function roundTrip(markdown: string): string {
  return serializeMarkdown(parseMarkdown(markdown));
}

/** Assert canonical markdown survives the loop unchanged. */
function expectCanonical(markdown: string) {
  expect(roundTrip(markdown)).toBe(markdown);
}

/** Assert markdown reaches a fixpoint after at most one normalization. */
function expectIdempotent(markdown: string) {
  const once = roundTrip(markdown);
  const twice = roundTrip(once);
  expect(twice).toBe(once);
}

// =============================================================================
// 1. Canonical round trips — byte-for-byte
// =============================================================================

describe('markdown round trip — canonical forms', () => {
  it('headings h1–h6', () => {
    expectCanonical('# One');
    expectCanonical('## Two');
    expectCanonical('### Three\n\n#### Four\n\n##### Five\n\n###### Six');
  });

  it('paragraphs', () => {
    expectCanonical('Just a paragraph.');
    expectCanonical('First paragraph.\n\nSecond paragraph.');
  });

  it('inline marks', () => {
    expectCanonical('Text with **bold** and *italic* and `code` and ~~strike~~.');
    expectCanonical('A [link](https://example.com) in text.');
    expectCanonical('Combined ***bold italic*** text.');
  });

  it('bullet lists', () => {
    expectCanonical('- one\n- two\n- three');
    expectCanonical('- parent\n  - child\n  - second child\n- sibling');
  });

  it('ordered lists, including non-1 start', () => {
    expectCanonical('1. first\n2. second\n3. third');
    expectCanonical('5. five\n6. six');
  });

  it('deeply nested mixed lists', () => {
    expectCanonical('- top\n  1. ordered child\n  2. another\n- next top');
  });

  it('task markers in list items (Logseq style)', () => {
    expectCanonical('- TODO buy milk\n- DOING write report\n- DONE ship release');
    expectCanonical('- WAITING on review\n- HOLD until Q3\n- IDEA voice capture');
  });

  it('task markers inline in paragraphs', () => {
    expectCanonical('TODO check the logs before standup');
  });

  it('timestamps', () => {
    expectCanonical('[09:30] standup notes');
    expectCanonical('- [14:05] called the vendor');
  });

  it('note links', () => {
    expectCanonical('See [[Product Roadmap]] for details.');
    expectCanonical('- [[Meeting Notes]] linked from a list');
    expectCanonical('[[One]] and [[Two]] in the same line.');
  });

  it('code blocks with language', () => {
    expectCanonical('```ts\nconst x = 1;\n```');
    expectCanonical('```\nplain block\n```');
  });

  it('code blocks preserve markdown-special content verbatim', () => {
    expectCanonical('```md\n# not a heading\n- not a list\n**not bold**\n[[not a link]]\n```');
    expectCanonical('```js\nconst re = /\\*\\*bold\\*\\*/g;\n```');
  });

  it('blockquotes', () => {
    expectCanonical('> a quoted line');
    expectCanonical('> first line\n> second line');
  });

  it('horizontal rule', () => {
    expectCanonical('above\n\n---\n\nbelow');
  });

  it('images', () => {
    expectCanonical('![alt text](.assets/img.png)');
    expectCanonical('![alt](.assets/img.png "a title")');
  });

  it('tables', () => {
    expectCanonical('| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |');
  });

  it('tables with inline marks in cells', () => {
    expectCanonical('| Col |\n| --- |\n| **bold** and `code` |');
  });

  it('a realistic journal entry', () => {
    expectCanonical(
      [
        '# 2026-06-12',
        '',
        '[09:15] Morning review, see [[Weekly Plan]].',
        '',
        '- TODO finish the markdown tests',
        '- DONE push v0.4.0',
        '',
        '## Meeting notes',
        '',
        '> decision: ship on Friday',
        '',
        '```ts',
        'const ready = true;',
        '```',
      ].join('\n'),
    );
  });

  it('unicode and emoji', () => {
    expectCanonical('Ünïcødé and 日本語 and 🎉 emoji.');
  });
});

// =============================================================================
// 2. Normalization reaches a fixpoint (never drifts)
// =============================================================================

describe('markdown round trip — idempotence after normalization', () => {
  const samples = [
    // Alternative list/emphasis syntax normalizes to the canonical style.
    '* star bullets\n* second',
    '+ plus bullets',
    '_underscore italic_ and __underscore bold__',
    // Timestamp padding.
    '[9:30] unpadded hour',
    // CANCELLED (two L) normalizes to CANCELED.
    '- CANCELLED old idea',
    // Setext heading → ATX.
    'Title\n=====',
    'Subtitle\n-----',
    // Loose/spaced lists tighten.
    '- one\n\n- two',
    // Hard-wrapped paragraph (breaks:true turns newline into hardBreak).
    'line one\nline two',
    // Trailing whitespace / extra blank lines collapse.
    'para with trailing spaces   \n\n\n\nnext para',
    // Literal asterisks that are not emphasis.
    '2 * 3 * 4 = 24',
    // Things the parser does not model stay as literal text — stably.
    '==highlight syntax== passes through',
    'a footnote[^1] reference',
    // Indented code block → fenced.
    '    indented code',
    // Numbered list written with all 1s.
    '1. a\n1. b\n1. c',
    // Table with alignment colons.
    '| h |\n|:---:|\n| c |',
    // HTML is disabled — tags become literal text.
    '<div>not html</div>',
    // Link with title.
    '[t](https://e.com "title")',
    // Empty-ish documents.
    '',
    '   ',
    '\n\n\n',
  ];

  for (const sample of samples) {
    it(`fixpoint: ${JSON.stringify(sample.slice(0, 40))}`, () => {
      expectIdempotent(sample);
    });
  }
});

// =============================================================================
// 3. Structural assertions — exact node shapes the editor depends on
// =============================================================================

describe('parseMarkdown — custom node structure', () => {
  it('parses task markers with normalized state attr', () => {
    const doc = parseMarkdown('TODO write tests');
    const para = doc.content![0];
    expect(para.type).toBe('paragraph');
    expect(para.content![0]).toEqual({ type: 'taskMarker', attrs: { state: 'todo' } });
    expect(para.content![1].text).toBe(' write tests');
  });

  it('normalizes CANCELLED → canceled state', () => {
    const doc = parseMarkdown('CANCELLED old plan');
    expect(doc.content![0].content![0].attrs).toEqual({ state: 'canceled' });
  });

  it('parses timestamps with zero-padded hour', () => {
    const doc = parseMarkdown('[9:05] note');
    expect(doc.content![0].content![0]).toEqual({
      type: 'timestamp',
      attrs: { time: '09:05' },
    });
  });

  it('rejects invalid timestamps (24:00 stays text)', () => {
    const doc = parseMarkdown('[24:00] not a time');
    expect(doc.content![0].content![0].type).toBe('text');
  });

  it('parses note links with title attr and null noteId', () => {
    const doc = parseMarkdown('see [[My Note]]');
    const link = doc.content![0].content!.find((n) => n.type === 'noteLink');
    expect(link?.attrs).toEqual({ title: 'My Note', noteId: null });
  });

  it('parses fenced code with language attr', () => {
    const doc = parseMarkdown('```python\nprint(1)\n```');
    const block = doc.content![0];
    expect(block.type).toBe('codeBlock');
    expect(block.attrs).toEqual({ language: 'python' });
    expect(block.content![0].text).toBe('print(1)\n');
  });

  it('parses tables into tableRow/tableHeader/tableCell with paragraph-wrapped cells', () => {
    const doc = parseMarkdown('| h |\n| --- |\n| c |');
    const table = doc.content![0];
    expect(table.type).toBe('table');
    const [headerRow, bodyRow] = table.content!;
    expect(headerRow.content![0].type).toBe('tableHeader');
    expect(headerRow.content![0].content![0].type).toBe('paragraph');
    expect(bodyRow.content![0].type).toBe('tableCell');
  });

  it('marks survive into text nodes', () => {
    const doc = parseMarkdown('**bold** plain');
    const [bold, plain] = doc.content![0].content!;
    expect(bold.marks).toEqual([{ type: 'bold' }]);
    expect(plain.marks).toBeUndefined();
  });

  it('link mark carries href', () => {
    const doc = parseMarkdown('[text](https://x.dev)');
    const textNode = doc.content![0].content![0];
    expect(textNode.marks?.[0].type).toBe('link');
    expect(textNode.marks?.[0].attrs?.href).toBe('https://x.dev');
  });
});

// =============================================================================
// 4. Serializer-only inputs (docs the editor can produce)
// =============================================================================

describe('serializeMarkdown — editor-built docs', () => {
  it('serializes Logseq task list nodes', () => {
    const md = serializeMarkdown({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { state: 'doing' },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'in progress' }] },
              ],
            },
          ],
        },
      ],
    });
    expect(md).toBe('DOING in progress');
  });

  it('strips file:// prefixes down to .assets/ paths on images', () => {
    const md = serializeMarkdown({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'file:///Users/x/ws/Personal/note.assets/pic.png', alt: 'a' },
            },
          ],
        },
      ],
    });
    expect(md).toBe('![a](.assets/pic.png)');
  });

  it('serializes highlight marks (==) even though the parser keeps them literal', () => {
    const md = serializeMarkdown({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hot', marks: [{ type: 'highlight' }] }],
        },
      ],
    });
    expect(md).toBe('==hot==');
    // And the literal form is stable thereafter.
    expectIdempotent(md);
  });

  it('empty doc serializes to empty string', () => {
    expect(serializeMarkdown({ type: 'doc', content: [] })).toBe('');
    expect(serializeMarkdown({})).toBe('');
  });
});
