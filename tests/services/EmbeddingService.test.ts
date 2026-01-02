/**
 * EmbeddingService Tests
 *
 * Uses mocked child process to simulate responses without spawning Python.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

const serviceRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
}));

vi.mock('child_process', () => {
  const { EventEmitter } = require('events');
  return {
    spawn: vi.fn(() => {
      const stderr = new EventEmitter();
      return {
        stdout: undefined,
        stderr,
        on: vi.fn(),
        kill: vi.fn(),
        stdin: {
          write: (chunk: string) => {
            const parsed = JSON.parse(chunk.trim());
            const response = {
              ok: true,
              id: parsed.id,
              model: 'mock',
              dims: 4,
              embedding: [1, 0, 0, 0],
              embeddings: [[1, 0, 0, 0]],
            };
            serviceRef.current?.handleResponse?.call(serviceRef.current, JSON.stringify(response));
          },
        },
      };
    }),
  };
});

import { getEmbeddingService } from '../../src/main/services/EmbeddingService';

describe('EmbeddingService', () => {
  const embeddingService = getEmbeddingService() as any;

  beforeEach(() => {
    embeddingService.initialized = false;
    embeddingService.initializing = false;
    embeddingService.pending.clear();
    embeddingService.process = null;
    serviceRef.current = embeddingService;
  });

  it('initializes and reports readiness', async () => {
    await embeddingService.initialize();
    expect(embeddingService.isReady()).toBe(true);
    expect(embeddingService.getDimensions()).toBe(384);
  });

  it('returns zero vector for empty text', async () => {
    embeddingService.initialized = true;
    embeddingService.process = {
      stdin: { write: vi.fn() },
      stdout: undefined,
      on: vi.fn(),
      kill: vi.fn(),
    };

    const emb = await embeddingService.getEmbedding('');
    expect(emb.every((v: number) => v === 0)).toBe(true);
  });

  it('handles batch embeddings and preserves empty positions', async () => {
    embeddingService.initialized = true;
    embeddingService.process = {
      stdin: {
        write: (chunk: string) => {
          const parsed = JSON.parse(chunk.trim());
          const resp = {
            ok: true,
            id: parsed.id,
            embeddings: [[0.5, 0.5, 0, 0]],
          };
          embeddingService.handleResponse(JSON.stringify(resp));
        },
      },
      stdout: undefined,
      on: vi.fn(),
      kill: vi.fn(),
    };

    const result = await embeddingService.batchEmbed(['text', '']);
    expect(result[0]).toEqual([0.5, 0.5, 0, 0]);
    expect(result[1]).toEqual(new Array(384).fill(0));
  });
});
