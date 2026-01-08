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
 * Node in the graph visualization
 */
export interface GraphNode {
  id: string;
  title: string;
  type: 'note' | 'tag' | 'topic';
  linkCount: number;
}

/**
 * Edge in the graph visualization
 */
export interface GraphEdge {
  source: string;
  target: string;
  type: 'link' | 'tag' | 'topic';
}

/**
 * Full graph data for visualization
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
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
