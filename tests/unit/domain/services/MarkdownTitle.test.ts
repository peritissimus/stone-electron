import { describe, expect, it } from 'vitest';
import { stripFirstHeading } from '../../../../src/main/domain/services/MarkdownTitle';

describe('MarkdownTitle', () => {
  it('removes only the first H1 and trims leading blank lines left behind', () => {
    expect(stripFirstHeading('\n# Title\n\nBody\n# Later')).toBe('Body\n# Later');
  });

  it('leaves markdown unchanged when no first-level heading exists', () => {
    expect(stripFirstHeading('## Section\n\nBody')).toBe('## Section\n\nBody');
  });
});
