import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { SimilarityCalculator } from '../src/main/domain/services/SimilarityCalculator';

// Exercise the actual shipped worker, with synthetic data and a separate model cache.
const corpus = JSON.parse(
  await readFile(new URL('../tests/evals/retrieval-corpus.json', import.meta.url), 'utf8'),
) as {
  notes: Array<{ id: string; text: string }>;
  queries: Array<{ text: string; relevant: string[] }>;
};
const cacheDir = path.resolve(process.env.STONE_EVAL_CACHE ?? '.cache/retrieval-eval/models');
// Set in the main thread so native getenv() sees the privacy setting.
process.env.ORT_DISABLE_TELEMETRY = '1';
const worker = new Worker(
  path.resolve(process.env.STONE_EVAL_WORKER ?? 'dist/main/workers/embedding.worker.cjs'),
  { workerData: { cacheDir } },
);
let sequence = 0;
function request<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = String(++sequence);
    const cleanup = () => {
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number) => onError(new Error(`Worker exited (${code}) during ${type}`));
    const onMessage = (message: { id: string; success: boolean; data: T; error?: string }) => {
      if (message.id !== id) return;
      cleanup();
      if (message.success) resolve(message.data);
      else reject(new Error(message.error ?? `${type} failed`));
    };
    const timer = setTimeout(
      () => onError(new Error(`${type} timed out after 10 minutes`)),
      600_000,
    );
    worker.on('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage({ id, type, ...payload });
  });
}
function validateVectors(vectors: number[][], count: number) {
  if (
    vectors.length !== count ||
    vectors.some(
      (v) => v.length !== 384 || v.some((n) => !Number.isFinite(n)) || !v.some((n) => n !== 0),
    )
  ) {
    throw new Error(
      'Embedding output must contain one finite, nonzero 384-dimensional vector per input',
    );
  }
}
try {
  console.log('Loading the production CPU embedding worker (first run downloads model weights)…');
  const model = await request<{ model: string; dims: number }>('init');
  const start = performance.now();
  const documents = await request<number[][]>('batchEmbed', {
    texts: corpus.notes.map((n) => n.text),
  });
  const queries = await request<number[][]>('batchEmbed', {
    texts: corpus.queries.map((q) => q.text),
  });
  validateVectors(documents, corpus.notes.length);
  validateVectors(queries, corpus.queries.length);
  const warmEmbeddingMs = Math.round(performance.now() - start);
  const rows = corpus.queries.map((query, index) => {
    const ranked = SimilarityCalculator.findMostSimilar(
      queries[index],
      documents,
      documents.length,
      -1,
    ).map((result) => corpus.notes[result.index].id);
    const rank = ranked.findIndex((id) => query.relevant.includes(id));
    return {
      query: query.text,
      top3: ranked.slice(0, 3),
      recallAt3:
        ranked.slice(0, 3).filter((id) => query.relevant.includes(id)).length /
        query.relevant.length,
      reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1),
    };
  });
  console.log('Checking cross-encoder relevance scores against the same synthetic corpus…');
  const reranking = [];
  for (const query of corpus.queries) {
    const scores = await request<number[]>('rerank', {
      query: query.text,
      texts: corpus.notes.map((note) => note.text),
    });
    if (
      scores.length !== corpus.notes.length ||
      scores.some((score) => !Number.isFinite(score)) ||
      new Set(scores).size < 2
    ) {
      throw new Error('Reranker must return distinct finite relevance scores for the corpus');
    }
    const ranked = scores
      .map((score, index) => ({ score, id: corpus.notes[index].id }))
      .sort((left, right) => right.score - left.score);
    const rank = ranked.findIndex(({ id }) => query.relevant.includes(id));
    reranking.push({
      query: query.text,
      top3: ranked.slice(0, 3),
      reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1),
    });
  }
  const report = {
    model,
    runtime: '@huggingface/transformers',
    dtype: 'q8',
    device: 'cpu',
    corpus: 'tests/evals/retrieval-corpus.json',
    queries: rows.length,
    recallAt3: rows.reduce((sum, row) => sum + row.recallAt3, 0) / rows.length,
    meanReciprocalRank: rows.reduce((sum, row) => sum + row.reciprocalRank, 0) / rows.length,
    warmEmbeddingMs,
    rerankerMeanReciprocalRank:
      reranking.reduce((sum, row) => sum + row.reciprocalRank, 0) / reranking.length,
    rows,
    reranking,
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/retrieval-eval.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (
    report.recallAt3 < 0.875 ||
    report.meanReciprocalRank < 0.75 ||
    report.rerankerMeanReciprocalRank < 0.75
  ) {
    throw new Error(
      'Retrieval regression: expected Recall@3 >= 0.875 and embedding/reranker MRR >= 0.75 on the smoke corpus',
    );
  }
} finally {
  await worker.terminate();
}
