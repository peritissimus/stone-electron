import { describe, expect, it } from 'vitest';
import { MarkdownProcessor } from '../../../../../src/main/adapters/out/integrations/MarkdownProcessor';

describe('MarkdownProcessor', () => {
  it('renders Stone markdown extensions to HTML', async () => {
    const processor = new MarkdownProcessor();

    const html = await processor.markdownToHtml(
      [
        '# Title',
        '',
        '[[Project Alpha]]',
        '',
        '\t## Indented heading',
        '\tIndented paragraph',
        '',
        'TODO Capture follow-up',
        '- DONE Ship release',
      ].join('\n'),
    );

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('data-type="note-link"');
    expect(html).toContain('data-title="Project Alpha"');
    expect(html).toContain('data-indent="1"');
    expect(html).toContain('data-state="todo"');
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-checked="true"');
  });

  it('converts common editor HTML back to markdown in the Node fallback path', () => {
    const processor = new MarkdownProcessor();

    const markdown = processor.htmlToMarkdown(`
      <h2 data-indent="1">Indented title</h2>
      <p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>
      <span data-type="note-link" data-title="Project Alpha">Project Alpha</span>
      <ul data-type="taskList">
        <li data-type="taskItem" data-state="doing"><p>Draft plan</p></li>
      </ul>
      <pre><code class="language-ts">const x = &lt;number&gt;1;</code></pre>
      <img src="image.png" alt="Diagram" />
    `);

    expect(markdown).toContain('## Indented title');
    expect(markdown).toContain('Hello world link');
    expect(markdown).toContain('[[Project Alpha]]');
    expect(markdown).toContain('- DOING Draft plan');
    expect(markdown).toContain('```ts\nconst x = 1;\n```');
    expect(markdown).toContain('![Diagram](image.png)');
  });

  it('parses and updates frontmatter while preserving content', () => {
    const processor = new MarkdownProcessor();

    expect(processor.parseFrontmatter('No frontmatter')).toEqual({
      content: 'No frontmatter',
      metadata: {},
    });
    expect(
      processor.parseFrontmatter('---\ntitle: Stone\nsource: https://example.com/a:b\n---\n# Body'),
    ).toEqual({
      content: '# Body',
      metadata: { title: 'Stone', source: 'https://example.com/a:b' },
    });
    expect(processor.updateFrontmatter('---\ntitle: Old\n---\nBody', { title: 'New', tag: 'work' }))
      .toBe('---\ntitle: New\ntag: work\n---\nBody');
  });

  it('extracts titles, plain text, links, wiki links, and safe filenames', () => {
    const processor = new MarkdownProcessor();

    expect(processor.extractTitle('')).toBeNull();
    expect(processor.extractTitle('\n# Main title\nBody')).toBe('Main title');
    expect(processor.extractTitle('\nPlain first line that is used as fallback')).toBe(
      'Plain first line that is used as fallback',
    );
    expect(processor.extractLinks('[OpenAI](https://openai.com) and [Stone](stone.md)')).toEqual([
      { text: 'OpenAI', href: 'https://openai.com' },
      { text: 'Stone', href: 'stone.md' },
    ]);
    expect(processor.extractWikiLinks('See [[Alpha]] and [[Beta/Gamma]]')).toEqual([
      'Alpha',
      'Beta/Gamma',
    ]);
    expect(processor.extractPlainText('# Title\n\n- item\n\n[Link](https://example.com)')).toBe(
      'Title\n\nitem\n\nLink',
    );
    expect(processor.sanitizeFilename('Bad / name: with * chars')).toBe('Bad - name- with - chars');
    expect(processor.generateFilename('', '.md')).toBe('Untitled.md');
    processor.clearCache();
  });
});
