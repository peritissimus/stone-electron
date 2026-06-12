import { describe, expect, it } from 'vitest';
import { TEMPLATE_STARTER_PACK } from '../../../../src/main/infrastructure/seed/templateStarterPack';

describe('TEMPLATE_STARTER_PACK', () => {
  it('ships stable, editable templates with frontmatter metadata and prompt placeholders', () => {
    expect(TEMPLATE_STARTER_PACK.map((template) => template.id)).toEqual([
      '1-on-1',
      'design-review',
      'ad-hoc-meeting',
      'rfc',
      'weekly-status',
      'postmortem',
    ]);

    for (const template of TEMPLATE_STARTER_PACK) {
      expect(template.body).toContain('---');
      expect(template.body).toContain('name:');
      expect(template.body).toContain('description:');
      expect(template.body).toMatch(/\{\{(date|prompt:|cursor)/);
    }

    expect(Object.isFrozen(TEMPLATE_STARTER_PACK)).toBe(true);
  });
});
