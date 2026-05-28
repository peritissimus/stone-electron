import { describe, expect, it } from 'vitest';
import { TemplateRenderer } from '../../../../src/main/domain/services/TemplateRenderer';

const now = new Date('2026-05-29T14:30:00');

describe('TemplateRenderer', () => {
  describe('extractPrompts', () => {
    it('returns prompt questions in order of first appearance, deduped', () => {
      const body = [
        '# {{prompt:Title?}}',
        'Attendees: {{prompt:Attendees?}}',
        'Topic again: {{prompt:Title?}}',
        'Notes: {{prompt:Notes?}}',
      ].join('\n');

      expect(TemplateRenderer.extractPrompts(body)).toEqual([
        'Title?',
        'Attendees?',
        'Notes?',
      ]);
    });

    it('ignores non-prompt placeholders', () => {
      expect(TemplateRenderer.extractPrompts('{{date}} {{time}} {{cursor}}')).toEqual([]);
    });

    it('trims whitespace inside the braces', () => {
      expect(TemplateRenderer.extractPrompts('{{  prompt:Hello?  }}')).toEqual(['Hello?']);
    });
  });

  describe('render', () => {
    it('substitutes date + time placeholders', () => {
      const out = TemplateRenderer.render('# {{date}} at {{time}}', { now });
      expect(out.body).toBe('# 2026-05-29 at 14:30');
      expect(out.cursorOffset).toBeNull();
    });

    it('uses prompt answers and leaves unanswered prompts empty', () => {
      const body = 'Hi {{prompt:Name?}}, you said {{prompt:Said?}}';
      const out = TemplateRenderer.render(body, {
        now,
        promptAnswers: { 'Name?': 'Sam' },
      });
      expect(out.body).toBe('Hi Sam, you said ');
    });

    it('reports cursorOffset at the position of {{cursor}} in the final body', () => {
      const out = TemplateRenderer.render('# Title\n\n{{cursor}}\n\nFooter', { now });
      // After substitution the cursor marker becomes empty; offset is
      // the index in the OUTPUT where the marker stood.
      expect(out.body).toBe('# Title\n\n\n\nFooter');
      expect(out.cursorOffset).toBe('# Title\n\n'.length);
    });

    it('reports the first cursor marker only if multiple exist', () => {
      const out = TemplateRenderer.render('a{{cursor}}b{{cursor}}c', { now });
      expect(out.body).toBe('abc');
      expect(out.cursorOffset).toBe(1);
    });

    it('passes unknown placeholders through verbatim so authors notice typos', () => {
      const out = TemplateRenderer.render('{{ date }} {{owner}} {{date_long}}', { now });
      expect(out.body).toBe('2026-05-29 {{owner}} {{date_long}}');
    });

    it('handles empty body and empty placeholder map', () => {
      expect(TemplateRenderer.render('', { now })).toEqual({ body: '', cursorOffset: null });
      expect(TemplateRenderer.render('plain text only', { now })).toEqual({
        body: 'plain text only',
        cursorOffset: null,
      });
    });

    it('keeps cursorOffset relative to the rendered body even with substitutions before it', () => {
      // 'Hi Sam' is 6 chars; the cursor lands right after.
      const out = TemplateRenderer.render('Hi {{prompt:Name?}}{{cursor}}', {
        now,
        promptAnswers: { 'Name?': 'Sam' },
      });
      expect(out.body).toBe('Hi Sam');
      expect(out.cursorOffset).toBe('Hi Sam'.length);
    });
  });
});
