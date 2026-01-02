/**
 * GraphService Tests
 *
 * Ensures graph caching, backlink/forward link mapping,
 * and link extraction from markdown work as expected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to keep output clean
const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

// Mock repositories
const mockNoteRepo = vi.hoisted(() => ({
  getBacklinks: vi.fn(),
  getForwardLinks: vi.fn(),
  findAll: vi.fn(),
  getAllLinks: vi.fn(),
  addLink: vi.fn(),
  removeLink: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
  })),
}));

import { getGraphService } from '../../src/main/services/GraphService';

describe('GraphService', () => {
  const graphService = getGraphService();

  beforeEach(() => {
    vi.clearAllMocks();
    graphService.invalidateAllCaches();
  });

  it('maps backlinks with default titles', async () => {
    const now = new Date();
    mockNoteRepo.getBacklinks.mockResolvedValue([
      { id: 'n-1', title: 'Backlinked', updatedAt: now },
      { id: 'n-2', title: '', updatedAt: now },
    ]);

    const result = await graphService.getBacklinks('target');

    expect(result).toEqual([
      { id: 'n-1', title: 'Backlinked', updatedAt: now },
      { id: 'n-2', title: 'Untitled', updatedAt: now },
    ]);
    expect(mockNoteRepo.getBacklinks).toHaveBeenCalledWith('target');
  });

  it('caches graph data and invalidates correctly', async () => {
    const nodes = [
      { id: 'a', title: 'A', isDeleted: false },
      { id: 'b', title: 'B', isDeleted: false },
    ];
    const links = [{ sourceNoteId: 'a', targetNoteId: 'b' }];

    mockNoteRepo.findAll.mockResolvedValue(nodes);
    mockNoteRepo.getAllLinks.mockResolvedValue(links);

    const first = await graphService.getGraphData();
    expect(first.nodes).toHaveLength(2);
    expect(first.links).toEqual([{ source: 'a', target: 'b' }]);
    expect(mockNoteRepo.findAll).toHaveBeenCalledTimes(1);
    expect(mockNoteRepo.getAllLinks).toHaveBeenCalledTimes(1);

    // Cached response should not hit repositories again
    await graphService.getGraphData();
    expect(mockNoteRepo.findAll).toHaveBeenCalledTimes(1);
    expect(mockNoteRepo.getAllLinks).toHaveBeenCalledTimes(1);

    // After invalidation, repositories are queried again
    graphService.invalidateGraphCache();
    await graphService.getGraphData();
    expect(mockNoteRepo.findAll).toHaveBeenCalledTimes(2);
    expect(mockNoteRepo.getAllLinks).toHaveBeenCalledTimes(2);
  });

  it('removes stale links when markdown has no link targets', async () => {
    mockNoteRepo.getForwardLinks.mockResolvedValue([
      { id: 'n-2', title: 'Other note' },
      { id: 'n-3', title: 'Another note' },
    ]);

    await graphService.updateLinksFromContent('source', 'Plain text without links');

    expect(mockNoteRepo.removeLink).toHaveBeenCalledWith('source', 'n-2');
    expect(mockNoteRepo.removeLink).toHaveBeenCalledWith('source', 'n-3');
    expect(mockNoteRepo.addLink).not.toHaveBeenCalled();
  });

  it('adds and removes links based on markdown references and caches title lookups', async () => {
    mockNoteRepo.getForwardLinks.mockResolvedValue([
      { id: 'target-1', title: 'Target One' },
      { id: 'stale', title: 'Old Link' },
    ]);

    mockNoteRepo.findAll.mockResolvedValue([
      { id: 'source', title: 'Source Note', isDeleted: false },
      { id: 'target-1', title: 'Target One', isDeleted: false },
      { id: 'target-2', title: 'Fresh Link', isDeleted: false },
    ]);

    await graphService.updateLinksFromContent('source', 'Link to [[Target One]] and [[Fresh Link]].');

    expect(mockNoteRepo.removeLink).toHaveBeenCalledWith('source', 'stale');
    expect(mockNoteRepo.addLink).toHaveBeenCalledWith('source', 'target-2');
    expect(mockNoteRepo.addLink).toHaveBeenCalledTimes(1);
    expect(mockNoteRepo.findAll).toHaveBeenCalledTimes(1);

    // Cached note title map should avoid another findAll call
    mockNoteRepo.removeLink.mockClear();
    mockNoteRepo.addLink.mockClear();
    await graphService.updateLinksFromContent('source', '[[Target One]]');
    expect(mockNoteRepo.findAll).toHaveBeenCalledTimes(1);
  });
});
