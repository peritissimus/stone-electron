import { describe, expect, it, vi } from 'vitest';
import { SingleShotSummarizer } from '../../../../../src/main/adapters/out/integrations/SingleShotSummarizer';
import type { ITextGenerator } from '../../../../../src/main/domain';

function textGenerator(): ITextGenerator {
  return {
    generateAnswer: vi.fn(),
    planQuery: vi.fn(),
    generateMarkdown: vi.fn().mockResolvedValue({ text: '  - summary  ' }),
  };
}

describe('SingleShotSummarizer', () => {
  it('renders the transcript placeholder, trims output, and reports progress', async () => {
    const generator = textGenerator();
    const onProgress = vi.fn();
    const summarizer = new SingleShotSummarizer({ textGenerator: generator });

    const result = await summarizer.summarize({
      transcript: 'hello transcript',
      promptTemplate: 'Summarize:\n{{transcript}}',
      onProgress,
    });

    expect(generator.generateMarkdown).toHaveBeenCalledWith({
      prompt: 'Summarize:\nhello transcript',
      system: expect.stringContaining('Output the result directly'),
    });
    expect(onProgress).toHaveBeenCalledWith({ step: 'finalizing', current: 0, total: 1 });
    expect(onProgress).toHaveBeenCalledWith({ step: 'finalizing', current: 1, total: 1 });
    expect(result).toEqual({ summary: '- summary', promptUsed: 'Summarize:\n{{transcript}}' });
  });

  it('appends the transcript when a template omits the placeholder', async () => {
    const generator = textGenerator();
    const summarizer = new SingleShotSummarizer({ textGenerator: generator });

    await summarizer.summarize({ transcript: 'raw', promptTemplate: 'Summarize this' });

    expect(generator.generateMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Summarize this\n\nTranscript:\nraw' }),
    );
  });

  it('forwards cancellation to the model and rejects a late response after abort', async () => {
    const generator = textGenerator();
    const controller = new AbortController();
    vi.mocked(generator.generateMarkdown).mockImplementation(async (request) => {
      expect(request.signal).toBe(controller.signal);
      controller.abort(new Error('job stopped'));
      return { text: 'late summary' };
    });
    const summarizer = new SingleShotSummarizer({ textGenerator: generator });
    const onProgress = vi.fn();
    await expect(
      summarizer.summarize({
        transcript: 'raw',
        promptTemplate: '{{transcript}}',
        signal: controller.signal,
        onProgress,
      }),
    ).rejects.toThrow('job stopped');
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});
