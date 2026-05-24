/**
 * LocalReranker — cross-encoder reranking via the embedding worker.
 *
 * Shares the worker process with Embedder (one thread holds both models;
 * lazy-loaded on first rerank call). Model: Xenova/ms-marco-MiniLM-L-6-v2
 * — a small MS-MARCO cross-encoder good for top-K re-scoring up to ~30
 * candidates in under a second.
 */

import type { IReranker, RerankRequest, RerankedDocument } from '../../../domain';
import { logger } from '../../../shared/utils';

/**
 * Worker-side interface the host exposes. Both Embedder's and Reranker's
 * adapters depend on this same client, but each only uses its own methods.
 */
export interface RerankerWorkerClient {
  isRerankerReady(): boolean;
  initializeReranker(): Promise<void>;
  rerank(query: string, texts: string[]): Promise<number[]>;
}

export interface LocalRerankerDeps {
  workerService: RerankerWorkerClient;
}

export class LocalReranker implements IReranker {
  constructor(private readonly deps: LocalRerankerDeps) {}

  isReady(): boolean {
    return this.deps.workerService.isRerankerReady();
  }

  async initialize(): Promise<void> {
    if (this.deps.workerService.isRerankerReady()) return;
    await this.deps.workerService.initializeReranker();
  }

  async rerank(request: RerankRequest): Promise<RerankedDocument[]> {
    if (request.documents.length === 0) return [];
    if (!request.query.trim()) {
      // Pass-through: no query means we can't score, so preserve input order.
      return request.documents.map((d) => ({ id: d.id, score: 0 }));
    }

    if (!this.isReady()) {
      try {
        await this.initialize();
      } catch (e) {
        logger.warn('[LocalReranker] initialize failed, returning unscored', e);
        return request.documents.map((d) => ({ id: d.id, score: 0 }));
      }
    }

    const texts = request.documents.map((d) => d.text);
    let scores: number[];
    try {
      scores = await this.deps.workerService.rerank(request.query, texts);
    } catch (e) {
      logger.warn('[LocalReranker] rerank failed, returning unscored', e);
      return request.documents.map((d) => ({ id: d.id, score: 0 }));
    }

    if (scores.length !== request.documents.length) {
      logger.warn('[LocalReranker] score count mismatch', {
        scoresLen: scores.length,
        docsLen: request.documents.length,
      });
      return request.documents.map((d) => ({ id: d.id, score: 0 }));
    }

    const scored: RerankedDocument[] = request.documents.map((d, i) => ({
      id: d.id,
      score: scores[i],
    }));
    scored.sort((a, b) => b.score - a.score);
    return request.topK ? scored.slice(0, request.topK) : scored;
  }
}
