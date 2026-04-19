/**
 * NoteGraphBuilder - Pure domain service for building and querying note link graphs.
 *
 * Encapsulates the graph-construction business rules:
 * - computing link counts (degree) per note from flat link rows
 * - depth-limited BFS neighborhood expansion around a center note
 * - selecting the set of visible notes (respecting the orphan flag)
 * - projecting notes + links into renderable GraphData (nodes/links)
 *
 * No I/O, no external dependencies. Callers pass already-loaded notes and links.
 */

/**
 * Minimal shape of a note link row this service needs. The application layer
 * passes rows loaded from the repository; only these two fields are used.
 */
export interface GraphLinkInput {
  sourceNoteId: string;
  targetNoteId: string;
}

/**
 * Minimal shape of a note this service needs for graph construction.
 */
export interface GraphNoteInput {
  id: string;
  title?: string | null;
}

export interface GraphNodeOutput {
  id: string;
  name: string;
  val: number;
  color?: string;
}

export interface GraphLinkOutput {
  source: string;
  target: string;
}

export interface GraphDataOutput {
  nodes: GraphNodeOutput[];
  links: GraphLinkOutput[];
}

export interface BuildGraphOptions {
  centerNoteId?: string;
  depth?: number;
  includeOrphans?: boolean;
}

export const NoteGraphBuilder = {
  /**
   * Count how many links touch each note (either as source or target).
   */
  computeLinkCounts(links: GraphLinkInput[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.sourceNoteId, (counts.get(link.sourceNoteId) || 0) + 1);
      counts.set(link.targetNoteId, (counts.get(link.targetNoteId) || 0) + 1);
    }
    return counts;
  },

  /**
   * Build an undirected adjacency map (noteId -> set of neighbor noteIds).
   */
  buildAdjacency(links: GraphLinkInput[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    for (const link of links) {
      if (!adjacency.has(link.sourceNoteId)) {
        adjacency.set(link.sourceNoteId, new Set());
      }
      if (!adjacency.has(link.targetNoteId)) {
        adjacency.set(link.targetNoteId, new Set());
      }
      adjacency.get(link.sourceNoteId)!.add(link.targetNoteId);
      adjacency.get(link.targetNoteId)!.add(link.sourceNoteId);
    }
    return adjacency;
  },

  /**
   * BFS from a center note, returning the set of note ids reachable within
   * `depth` hops (inclusive of the center itself).
   */
  expandNeighborhood(
    links: GraphLinkInput[],
    centerNoteId: string,
    depth: number,
  ): Set<string> {
    const included = new Set<string>();
    included.add(centerNoteId);

    if (depth <= 0) return included;

    const queue: Array<{ id: string; d: number }> = [{ id: centerNoteId, d: 0 }];

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d >= depth) continue;

      for (const link of links) {
        let otherId: string | null = null;
        if (link.sourceNoteId === id) {
          otherId = link.targetNoteId;
        } else if (link.targetNoteId === id) {
          otherId = link.sourceNoteId;
        }
        if (otherId && !included.has(otherId)) {
          included.add(otherId);
          queue.push({ id: otherId, d: d + 1 });
        }
      }
    }

    return included;
  },

  /**
   * Return ids of notes that have no incoming or outgoing links.
   */
  findOrphans(notes: GraphNoteInput[], links: GraphLinkInput[]): string[] {
    const counts = this.computeLinkCounts(links);
    return notes.filter((n) => (counts.get(n.id) || 0) === 0).map((n) => n.id);
  },

  /**
   * Select which note ids should appear in the graph view based on options:
   *  - If `centerNoteId` is provided, BFS up to `depth` hops.
   *  - Otherwise include all notes, optionally filtering out orphans.
   */
  selectIncludedNotes(
    notes: GraphNoteInput[],
    links: GraphLinkInput[],
    options: BuildGraphOptions,
  ): Set<string> {
    const { centerNoteId, depth = 2, includeOrphans = false } = options;

    if (centerNoteId) {
      return this.expandNeighborhood(links, centerNoteId, depth);
    }

    const counts = this.computeLinkCounts(links);
    const included = new Set<string>();
    for (const note of notes) {
      if (includeOrphans || (counts.get(note.id) || 0) > 0) {
        included.add(note.id);
      }
    }
    return included;
  },

  /**
   * Build full GraphData (nodes + links) from loaded notes and links.
   * Node `val` is the total degree of the note; notes with no links get 1
   * so they are still visible in force-directed layouts.
   */
  buildGraphData(
    notes: GraphNoteInput[],
    links: GraphLinkInput[],
    options: BuildGraphOptions = {},
  ): GraphDataOutput {
    const includedNotes = this.selectIncludedNotes(notes, links, options);
    const linkCounts = this.computeLinkCounts(links);

    const nodes: GraphNodeOutput[] = [];
    for (const note of notes) {
      if (includedNotes.has(note.id)) {
        nodes.push({
          id: note.id,
          name: note.title || 'Untitled',
          val: linkCounts.get(note.id) || 1,
        });
      }
    }

    const outLinks: GraphLinkOutput[] = [];
    for (const link of links) {
      if (includedNotes.has(link.sourceNoteId) && includedNotes.has(link.targetNoteId)) {
        outLinks.push({
          source: link.sourceNoteId,
          target: link.targetNoteId,
        });
      }
    }

    return { nodes, links: outLinks };
  },
};
