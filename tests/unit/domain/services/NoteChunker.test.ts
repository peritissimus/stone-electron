import { describe, it, expect } from 'vitest';
import { NoteChunker } from '../../../../src/main/domain/services/NoteChunker';

describe('NoteChunker', () => {
  it('returns no chunks for empty/whitespace input', () => {
    expect(NoteChunker.chunk('n1', '')).toEqual([]);
    expect(NoteChunker.chunk('n1', '   \n\n  \n')).toEqual([]);
  });

  it('produces a single chunk for short markdown with no headings', () => {
    const chunks = NoteChunker.chunk('n1', 'Just one paragraph.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      id: 'n1:0',
      index: 0,
      headingPath: [],
      text: 'Just one paragraph.',
    });
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('strips YAML frontmatter before chunking', () => {
    const md = `---\ntitle: Foo\ntags: [a, b]\n---\n\nReal content here.`;
    const chunks = NoteChunker.chunk('n1', md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Real content here.');
  });

  it('tracks heading path through nested sections', () => {
    const md = [
      '# Top',
      '',
      'Top body.',
      '',
      '## Middle',
      '',
      'Middle body.',
      '',
      '### Leaf',
      '',
      'Leaf body.',
      '',
      '## Sibling',
      '',
      'Sibling body.',
    ].join('\n');

    const chunks = NoteChunker.chunk('n1', md);
    const byText = (t: string) => chunks.find((c) => c.text.includes(t))!;

    expect(byText('Top body').headingPath).toEqual(['Top']);
    expect(byText('Middle body').headingPath).toEqual(['Top', 'Middle']);
    expect(byText('Leaf body').headingPath).toEqual(['Top', 'Middle', 'Leaf']);
    expect(byText('Sibling body').headingPath).toEqual(['Top', 'Sibling']);
  });

  it('does not treat lines inside fenced code blocks as headings', () => {
    const md = [
      '# Real heading',
      '',
      '```',
      '# not a heading',
      'def foo():',
      '    pass',
      '```',
      '',
      'after',
    ].join('\n');
    const chunks = NoteChunker.chunk('n1', md);
    // All content lives under "Real heading"; no chunk should have a heading
    // path including "not a heading".
    for (const c of chunks) {
      expect(c.headingPath).not.toContain('not a heading');
    }
  });

  it('packs multiple paragraphs into one chunk under the budget', () => {
    const md = 'Para one.\n\nPara two.\n\nPara three.';
    const chunks = NoteChunker.chunk('n1', md, { maxChars: 1000, overlapChars: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('Para one.');
    expect(chunks[0].text).toContain('Para three.');
  });

  it('breaks across chunks when paragraphs exceed budget', () => {
    const big = 'x'.repeat(300);
    const md = [big, big, big, big].join('\n\n');
    const chunks = NoteChunker.chunk('n1', md, { maxChars: 350, overlapChars: 0, minChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(350);
    }
  });

  it('hard-splits a single paragraph that exceeds budget', () => {
    const giant = 'a'.repeat(5000);
    const chunks = NoteChunker.chunk('n1', giant, { maxChars: 500, overlapChars: 0, minChars: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(500);
    }
  });

  it('applies overlap between adjacent chunks', () => {
    const block = 'Lorem ipsum dolor sit amet '.repeat(20); // ~540 chars
    const md = [block, block, block].join('\n\n');
    const chunks = NoteChunker.chunk('n1', md, { maxChars: 600, overlapChars: 60, minChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    const prevTail = chunks[0].text.slice(-60);
    expect(chunks[1].text.startsWith(prevTail.slice(0, 30))).toBe(true);
  });

  it('produces deterministic chunk IDs', () => {
    const md = '# A\n\nfoo\n\n# B\n\nbar';
    const first = NoteChunker.chunk('note-xyz', md);
    const second = NoteChunker.chunk('note-xyz', md);
    expect(first.map((c) => c.id)).toEqual(second.map((c) => c.id));
    expect(first[0].id).toBe('note-xyz:0');
    expect(first[first.length - 1].id).toBe(`note-xyz:${first.length - 1}`);
  });

  it('coalesces a tiny trailing chunk into the previous one when same heading', () => {
    const big = 'word '.repeat(180); // ~900 chars
    const md = `${big}\n\nshort.`;
    const chunks = NoteChunker.chunk('n1', md, { maxChars: 1500, overlapChars: 0, minChars: 250 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.endsWith('short.')).toBe(true);
  });
});
