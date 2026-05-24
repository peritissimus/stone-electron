import { describe, it, expect } from 'vitest';
import {
  TopicSuggester,
  type SuggesterChunk,
} from '../../../../src/main/domain/services/TopicSuggester';

function vec(values: number[], dims = 8): number[] {
  // Pad to `dims` so all chunks share the same vector length.
  const out = new Array(dims).fill(0);
  for (let i = 0; i < Math.min(values.length, dims); i += 1) out[i] = values[i];
  // Normalize for clean cosine math.
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return out;
  return out.map((v) => v / norm);
}

function chunk(
  id: string,
  noteId: string,
  noteTitle: string,
  text: string,
  embedding: number[],
  headingPath: string[] = [],
): SuggesterChunk {
  return { chunkId: id, noteId, noteTitle, headingPath, text, embedding };
}

describe('TopicSuggester', () => {
  it('returns no clusters when corpus is too small', () => {
    const chunks: SuggesterChunk[] = [
      chunk('c1', 'n1', 'Alpha', 'a', vec([1, 0, 0])),
      chunk('c2', 'n2', 'Beta', 'b', vec([0, 1, 0])),
    ];
    expect(TopicSuggester.suggest(chunks)).toEqual([]);
  });

  it('groups chunks with cosine ≥ threshold into one cluster', () => {
    // Cluster A: 4 highly-similar vectors about "auth sessions"
    // Cluster B: 4 highly-similar vectors about "image pipeline"
    // Plus 2 outliers
    const auth = vec([1, 0, 0]);
    const image = vec([0, 1, 0]);
    const chunks: SuggesterChunk[] = [
      chunk('a1', 'n-auth-1', 'Auth Work', 'auth sessions and refresh tokens', vec([0.95, 0.05, 0])),
      chunk('a2', 'n-auth-2', 'Auth Work', 'session management and oauth', vec([0.92, 0.08, 0])),
      chunk('a3', 'n-auth-1', 'Auth Work', 'rbac roles and permissions for auth', vec([0.9, 0.1, 0])),
      chunk('a4', 'n-auth-3', 'Auth Sessions', 'session tokens refresh oauth', vec([0.88, 0.12, 0])),

      chunk('b1', 'n-img-1', 'Image Pipeline', 'image tagging pipeline deployment', vec([0.05, 0.95, 0])),
      chunk('b2', 'n-img-2', 'Image Pipeline', 'tagging models for image processing', vec([0.08, 0.92, 0])),
      chunk('b3', 'n-img-1', 'Image Pipeline', 'image classification and tagging', vec([0.1, 0.9, 0])),
      chunk('b4', 'n-img-3', 'Tagging Pipeline', 'pipeline image tags deploy', vec([0.12, 0.88, 0])),

      chunk('o1', 'n-out-1', 'Outlier 1', 'lonely note', vec([0, 0, 1])),
      chunk('o2', 'n-out-2', 'Outlier 2', 'another lonely note', vec([0, 0, -1])),
    ];

    const clusters = TopicSuggester.suggest(chunks, {
      cosineThreshold: 0.7,
      minClusterSize: 3,
      maxClusters: 5,
      representativesPerCluster: 3,
    });

    // Should produce exactly two real clusters.
    expect(clusters.length).toBe(2);

    const authCluster = clusters.find((c) =>
      c.chunkIds.some((id) => id.startsWith('a')),
    );
    const imageCluster = clusters.find((c) =>
      c.chunkIds.some((id) => id.startsWith('b')),
    );
    expect(authCluster).toBeDefined();
    expect(imageCluster).toBeDefined();

    expect(authCluster!.chunkIds.sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(imageCluster!.chunkIds.sort()).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(authCluster!.label.length).toBeGreaterThan(0);
    expect(imageCluster!.label.length).toBeGreaterThan(0);
    // Labels should be distinct between the two clusters.
    expect(authCluster!.label).not.toBe(imageCluster!.label);
  });

  it('attaches representative chunks ranked by centroid centrality', () => {
    const chunks: SuggesterChunk[] = [
      chunk('a1', 'n1', 'Topic A', 'first foo bar one', vec([1, 0, 0])),
      chunk('a2', 'n1', 'Topic A', 'second foo bar two', vec([0.9, 0.1, 0])),
      chunk('a3', 'n2', 'Topic A', 'third foo bar three', vec([0.85, 0.15, 0])),
      chunk('a4', 'n2', 'Topic A', 'fourth foo bar four', vec([0.8, 0.2, 0])),
    ];
    const [cluster] = TopicSuggester.suggest(chunks, {
      cosineThreshold: 0.5,
      minClusterSize: 3,
      maxClusters: 3,
      representativesPerCluster: 2,
    });
    expect(cluster).toBeDefined();
    expect(cluster.representatives).toHaveLength(2);
    expect(cluster.noteIds.sort()).toEqual(['n1', 'n2']);
  });

  it('produces deterministic output for identical input', () => {
    const chunks: SuggesterChunk[] = [
      chunk('a1', 'n1', 'A', 'alpha alpha alpha', vec([1, 0, 0])),
      chunk('a2', 'n1', 'A', 'alpha alpha beta', vec([0.9, 0.1, 0])),
      chunk('a3', 'n2', 'A', 'alpha gamma alpha', vec([0.85, 0.15, 0])),
      chunk('a4', 'n2', 'A', 'alpha delta alpha', vec([0.8, 0.2, 0])),
    ];
    const first = TopicSuggester.suggest(chunks);
    const second = TopicSuggester.suggest(chunks);
    expect(first.map((c) => c.chunkIds.sort())).toEqual(second.map((c) => c.chunkIds.sort()));
    expect(first.map((c) => c.label)).toEqual(second.map((c) => c.label));
  });
});
