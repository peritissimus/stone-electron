import { describe, expect, it, vi } from 'vitest';
import { SummarizeDailyReviewUseCase } from '../../../../src/main/application/usecases/dailyReview/SummarizeDailyReviewUseCase';
import type { DailyReviewSnapshot, IGetDailyReviewUseCase, ITextGenerator } from '../../../../src/main/domain';

function snapshot(over: Partial<DailyReviewSnapshot> = {}): DailyReviewSnapshot {
  return {
    date: '2026-06-16',
    todayJournal: { date: '2026-06-16', noteId: null, contentPreview: null },
    todayMeetings: [],
    openTasks: [],
    recentNotes: [],
    onThisDay: [],
    ...over,
  };
}

function make(over: Partial<DailyReviewSnapshot> = {}) {
  const getDailyReview = { execute: vi.fn(async () => snapshot(over)) } as unknown as IGetDailyReviewUseCase;
  const generateMarkdown = vi.fn(async (_req: { prompt: string; system?: string }) => ({
    text: '- did things',
  }));
  const textGenerator = { generateMarkdown } as unknown as ITextGenerator;
  const appendToJournal = vi.fn(async () => ({ noteId: 'journal-1', appended: true }));
  const useCase = new SummarizeDailyReviewUseCase({ getDailyReview, textGenerator, appendToJournal });
  return { useCase, generateMarkdown, appendToJournal };
}

describe('SummarizeDailyReviewUseCase', () => {
  it('summarizes the snapshot without touching the journal by default', async () => {
    const { useCase, generateMarkdown, appendToJournal } = make({
      linearIssues: [
        { identifier: 'ENG-1', title: 'Ship it', state: 'In Progress', priority: 1, url: 'u', dueDate: null },
      ],
    });

    const result = await useCase.execute();

    expect(generateMarkdown).toHaveBeenCalledTimes(1);
    // The Linear evidence is folded into the prompt.
    expect(generateMarkdown.mock.calls[0][0].prompt).toContain('ENG-1 Ship it');
    expect(appendToJournal).not.toHaveBeenCalled();
    expect(result).toEqual({ summary: '- did things', journalNoteId: null });
  });

  it('appends to the journal when saveToJournal is set', async () => {
    const { useCase, appendToJournal } = make();

    const result = await useCase.execute({ saveToJournal: true });

    expect(appendToJournal).toHaveBeenCalledWith(
      expect.stringContaining('- did things'),
      undefined,
    );
    expect(result.journalNoteId).toBe('journal-1');
  });
});
