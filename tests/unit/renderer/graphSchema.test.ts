import { describe, expect, it } from 'vitest';
import { GraphDataSchema } from '../../../src/renderer/api/schemas';

describe('GraphDataSchema', () => {
  it('accepts the current rich graph contract', () => {
    const parsed = GraphDataSchema.parse({
      nodes: [
        {
          id: 'note-1',
          label: 'Graph Note',
          type: 'note',
          metadata: { degree: 3 },
        },
      ],
      links: [{ source: 'note-1', target: 'note-2', type: 'link', weight: 1 }],
    });

    expect(parsed.nodes[0]).toMatchObject({
      id: 'note-1',
      label: 'Graph Note',
      type: 'note',
      metadata: { degree: 3 },
    });
    expect(parsed.links[0]).toMatchObject({
      source: 'note-1',
      target: 'note-2',
      type: 'link',
      weight: 1,
    });
  });

  it('rejects the removed name/val graph shape', () => {
    expect(() =>
      GraphDataSchema.parse({
        nodes: [{ id: 'note-1', name: 'Old Note', val: 3 }],
        links: [{ source: 'note-1', target: 'note-2' }],
      }),
    ).toThrow();
  });
});
