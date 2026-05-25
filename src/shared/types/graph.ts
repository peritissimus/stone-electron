/**
 * Wire shape for the note graph.
 *
 * Single source of truth for renderer-side graph rendering. The backend
 * port (`IGraphUseCases.ts`) keeps its own structurally-identical
 * definition because domain may not import from shared.
 *
 * Node + link are discriminated on `type` so that as we add notebook /
 * tag / topic nodes, each variant can carry its own typed metadata
 * without renderers having to coerce `Record<string, unknown>`.
 */

export type GraphNodeKind = 'note' | 'notebook' | 'tag' | 'topic';
export type GraphLinkKind = 'link' | 'reference' | 'tag' | 'topic' | 'parent';

interface GraphNodeBase {
  id: string;
  label: string;
}

export interface NoteGraphNode extends GraphNodeBase {
  type: 'note';
  metadata: {
    /** In-degree + out-degree for this note in the rendered graph. */
    degree: number;
  };
}

// Placeholder variants — flesh out metadata when these node kinds are
// actually emitted. Today only `note` is produced by the builder.
export interface NotebookGraphNode extends GraphNodeBase {
  type: 'notebook';
  metadata?: Record<string, never>;
}

export interface TagGraphNode extends GraphNodeBase {
  type: 'tag';
  metadata?: Record<string, never>;
}

export interface TopicGraphNode extends GraphNodeBase {
  type: 'topic';
  metadata?: Record<string, never>;
}

export type GraphNode = NoteGraphNode | NotebookGraphNode | TagGraphNode | TopicGraphNode;

export interface GraphLink {
  source: string;
  target: string;
  type: GraphLinkKind;
  /** Edge weight ≥ 1; today always 1 from the builder. */
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
