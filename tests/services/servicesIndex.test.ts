/**
 * Services index export smoke test
 *
 * Ensures re-exports are wired for consumers.
 */

import { describe, it, expect } from 'vitest';
import {
  getEventBus,
  getFileSystemService,
  getFileWatcherService,
  getMarkdownService,
  getWorkspaceService,
  getNotebookService,
  getNoteService,
  getGraphService,
  getSearchService,
  getTaskService,
  getExportService,
  getSyncService,
  getTagService,
  getAttachmentService,
  getEmbeddingService,
  getTopicService,
} from '../../src/main/services';

describe('services index exports', () => {
  it('exposes service getters', () => {
    expect(typeof getEventBus).toBe('function');
    expect(typeof getFileSystemService).toBe('function');
    expect(typeof getFileWatcherService).toBe('function');
    expect(typeof getMarkdownService).toBe('function');
    expect(typeof getWorkspaceService).toBe('function');
    expect(typeof getNotebookService).toBe('function');
    expect(typeof getNoteService).toBe('function');
    expect(typeof getGraphService).toBe('function');
    expect(typeof getSearchService).toBe('function');
    expect(typeof getTaskService).toBe('function');
    expect(typeof getExportService).toBe('function');
    expect(typeof getSyncService).toBe('function');
    expect(typeof getTagService).toBe('function');
    expect(typeof getAttachmentService).toBe('function');
    expect(typeof getEmbeddingService).toBe('function');
    expect(typeof getTopicService).toBe('function');
  });
});
