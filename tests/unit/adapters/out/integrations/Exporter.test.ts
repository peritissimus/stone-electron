import { describe, expect, it } from 'vitest';
import { Exporter } from '../../../../../src/main/adapters/out/integrations/Exporter';

describe('Exporter', () => {
  it('generates a complete styled HTML document and escapes the title', () => {
    const exporter = new Exporter();

    const html = exporter.generateHtmlDocument('<h1>Hello</h1>', {
      title: 'A <dangerous> "title"',
      includeStyles: true,
      theme: 'dark',
      customCss: '.note { color: red; }',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>A &lt;dangerous&gt; &quot;title&quot;</title>');
    expect(html).toContain('--bg: #1a1a1a');
    expect(html).toContain('.note { color: red; }');
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('can omit styles and reports PDF unavailability outside Electron', async () => {
    const exporter = new Exporter();

    expect(exporter.generateHtmlDocument('<p>Plain</p>', { includeStyles: false })).not.toContain(
      '<style>',
    );
    expect(exporter.isPdfAvailable()).toBe(false);
    await expect(exporter.renderToPdf('<p>Plain</p>')).rejects.toThrow(
      'PDF export is not available in this environment',
    );
  });
});
