/**
 * Graph DTOs - Data transfer objects for note links and graph visualization
 */

/**
 * Link between notes
 */
export interface NoteLinkDTO {
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  linkText: string;
  linkType: 'wiki' | 'markdown';
}

/**
 * Backlinks response
 */
export interface BacklinksResponseDTO {
  noteId: string;
  noteTitle: string;
  backlinks: NoteLinkDTO[];
  count: number;
}

/**
 * Forward links response
 */
export interface ForwardLinksResponseDTO {
  noteId: string;
  noteTitle: string;
  forwardLinks: NoteLinkDTO[];
  count: number;
}

/**
 * Graph node
 */
export interface GraphNodeDTO {
  id: string;
  label: string;
  type: 'note' | 'tag' | 'topic';
  linkCount: number;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    isFavorite?: boolean;
  };
}

/**
 * Graph edge
 */
export interface GraphEdgeDTO {
  source: string;
  target: string;
  type: 'link' | 'tag' | 'topic';
  label?: string;
}

/**
 * Graph data for visualization
 */
export interface GraphDataDTO {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    orphanCount: number;
  };
}

/**
 * Get graph data request
 */
export interface GetGraphDataRequestDTO {
  centerNoteId?: string;
  depth?: number;
  includeOrphans?: boolean;
  includeTags?: boolean;
  includeTopics?: boolean;
}

/**
 * Update note links request (called after save)
 */
export interface UpdateNoteLinksRequestDTO {
  noteId: string;
  content: string;
}
