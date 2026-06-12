import { describe, expect, it } from 'vitest';
import { NoteGraphBuilder } from '../../../../src/main/domain/services/NoteGraphBuilder';

const notes = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'c', title: 'Gamma' },
  { id: 'orphan', title: null },
];

const links = [
  { sourceNoteId: 'a', targetNoteId: 'b' },
  { sourceNoteId: 'b', targetNoteId: 'c' },
];

describe('NoteGraphBuilder', () => {
  it('counts links, finds orphans, and expands centered neighborhoods by depth', () => {
    expect(Object.fromEntries(NoteGraphBuilder.computeLinkCounts(links))).toEqual({
      a: 1,
      b: 2,
      c: 1,
    });
    expect(NoteGraphBuilder.findOrphans(notes, links)).toEqual(['orphan']);
    expect([...NoteGraphBuilder.expandNeighborhood(links, 'a', 1)]).toEqual(['a', 'b']);
  });

  it('builds graph data with orphan filtering and link projection', () => {
    const graph = NoteGraphBuilder.buildGraphData(notes, links);

    expect(graph.nodes.map((node) => [node.id, node.label, node.metadata.degree])).toEqual([
      ['a', 'Alpha', 1],
      ['b', 'Beta', 2],
      ['c', 'Gamma', 1],
    ]);
    expect(graph.links).toEqual([
      { source: 'a', target: 'b', type: 'link', weight: 1 },
      { source: 'b', target: 'c', type: 'link', weight: 1 },
    ]);
  });
});
