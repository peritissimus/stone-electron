/**
 * ExportService Tests
 *
 * Covers HTML preparation and markdown retrieval paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRawContent = vi.hoisted(() => vi.fn());

// Mock NoteService dependency
vi.mock('../../src/main/services/NoteService', () => ({
  getNoteService: vi.fn(() => ({
    getRawContent: mockGetRawContent,
  })),
}));

// Mock logger to assert warnings/debug logs
const loggerSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

import { createExportService } from '../../src/main/services/ExportService';

// Create mock NoteService
const mockNoteService = {
  getRawContent: mockGetRawContent,
};

describe('ExportService', () => {
  // Use factory function with mocked dependencies instead of singleton getter
  const exportService = createExportService({ noteService: mockNoteService as any });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('escapes titles when preparing HTML export', async () => {
    const html = await exportService.prepareHtmlExport(
      'note-1',
      '<p>Body</p>',
      'Danger & <script>alert(1)</script>',
    );

    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('<title>Danger &amp; &lt;script&gt;alert(1)&lt;/script&gt;</title>');
    expect(html).toContain('<h1>Danger &amp; &lt;script&gt;alert(1)&lt;/script&gt;</h1>');
  });

  it('returns markdown content when available', async () => {
    mockGetRawContent.mockResolvedValue('# Heading');

    const result = await exportService.getMarkdownForExport('note-1');

    expect(result).toBe('# Heading');
    expect(loggerSpies.debug).toHaveBeenCalledWith(expect.stringContaining('note-1'));
  });

  it('warns and returns null when markdown is missing', async () => {
    mockGetRawContent.mockResolvedValue(null);

    const result = await exportService.getMarkdownForExport('note-2');

    expect(result).toBeNull();
    expect(loggerSpies.warn).toHaveBeenCalledWith(expect.stringContaining('note-2'));
  });
});
