/**
 * Graph Use Case Ports - Inbound interfaces for link/graph operations
 */

/**
 * Link between two notes
 */
export interface NoteLink {
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  linkText: string;
}

/**
 * Node in the graph visualization. Discriminated on `type` so each kind
 * carries its own typed metadata. Structurally mirrors the wire shape in
 * `@shared/types/graph` (domain may not import shared, so the two are
 * kept in sync by hand).
 */
export type GraphNodeKind = 'note' | 'notebook' | 'tag' | 'topic';
export type GraphLinkKind = 'link' | 'reference' | 'tag' | 'topic' | 'parent';

interface GraphNodeBase {
  id: string;
  label: string;
}

export interface NoteGraphNode extends GraphNodeBase {
  type: 'note';
  metadata: { degree: number };
}

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

/**
 * Link in the graph visualization
 */
export interface GraphLink {
  source: string;
  target: string;
  type: GraphLinkKind;
  weight?: number;
}

/**
 * Full graph data for visualization
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Get backlinks (notes that link TO this note)
 */
export interface IGetBacklinksUseCase {
  execute(noteId: string): Promise<NoteLink[]>;
}

/**
 * Get forward links (notes that this note links TO)
 */
export interface IGetForwardLinksUseCase {
  execute(noteId: string): Promise<NoteLink[]>;
}

/**
 * Get graph data for visualization
 */
export interface IGetGraphDataUseCase {
  execute(options?: {
    centerNoteId?: string;
    depth?: number;
    includeOrphans?: boolean;
  }): Promise<GraphData>;
}

/**
 * Update links for a note (called after save)
 */
export interface IUpdateNoteLinksUseCase {
  execute(noteId: string, content: string): Promise<void>;
}

/**
 * Aggregated graph use cases
 */
export interface IGraphUseCases {
  getBacklinks: IGetBacklinksUseCase;
  getForwardLinks: IGetForwardLinksUseCase;
  getGraphData: IGetGraphDataUseCase;
  updateNoteLinks: IUpdateNoteLinksUseCase;
}
