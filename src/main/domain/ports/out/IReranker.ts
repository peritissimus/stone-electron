/**
 * IReranker — cross-encoder reranking over (query, document) pairs.
 *
 * Used to re-score the top candidates from initial retrieval (FTS + vector
 * + RRF) with a model that looks at both the query and the document text
 * together. More expensive per pair than embedding cosine, but applied to
 * 20–30 candidates it's bounded and meaningfully improves top-K precision.
 *
 * Local implementation runs Xenova/ms-marco-MiniLM-L-6-v2 in the embedding
 * worker. A cloud variant could later implement the same port.
 */

export interface RerankDocument {
  /** Caller-owned identifier — the reranker just passes it back so the
   *  caller can re-order their original list without joining on text. */
  id: string;
  text: string;
}

export interface RerankRequest {
  query: string;
  documents: RerankDocument[];
  /** Truncate to top-K after scoring. If omitted, returns all scored. */
  topK?: number;
}

export interface RerankedDocument {
  id: string;
  /** Higher = more relevant. Cross-encoder logit; ranges are model-specific. */
  score: number;
}

export interface IReranker {
  /** Whether the reranker model is ready to score. */
  isReady(): boolean;

  /** Load the reranker model (lazy — only call when first needed). */
  initialize(): Promise<void>;

  /** Score every (query, document) pair, return them sorted by score desc. */
  rerank(request: RerankRequest): Promise<RerankedDocument[]>;
}
