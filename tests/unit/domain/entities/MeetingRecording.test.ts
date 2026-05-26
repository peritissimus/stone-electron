import { describe, expect, it } from 'vitest';
import { MeetingRecordingEntity } from '../../../../src/main/domain/entities/MeetingRecording';
import { MeetingRecordingValidationError } from '../../../../src/main/domain/errors';

const base = {
  id: 'rec-1',
  workspaceId: 'ws-1',
  title: 'Sync with Sam',
  audioPath: '.stone/recordings/rec-1.webm',
};

describe('MeetingRecordingEntity', () => {
  it('starts in recording status with the audio path attached', () => {
    const rec = MeetingRecordingEntity.create(base);
    expect(rec.status).toBe('recording');
    expect(rec.audioPath).toBe(base.audioPath);
    expect(rec.title).toBe('Sync with Sam');
    expect(rec.transcriptText).toBeNull();
    expect(rec.summary).toBeNull();
    expect(rec.journalDate).toBeNull();
  });

  it('defaults the title when caller passes whitespace', () => {
    const rec = MeetingRecordingEntity.create({ ...base, title: '   ' });
    expect(rec.title).toMatch(/^Meeting \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('throws when required fields are missing', () => {
    expect(() => MeetingRecordingEntity.create({ ...base, id: '' })).toThrow(
      MeetingRecordingValidationError,
    );
    expect(() => MeetingRecordingEntity.create({ ...base, workspaceId: '' })).toThrow(
      MeetingRecordingValidationError,
    );
    expect(() => MeetingRecordingEntity.create({ ...base, audioPath: '' })).toThrow(
      MeetingRecordingValidationError,
    );
  });

  it('walks recording → transcribing → summarizing → ready with the right side effects', () => {
    const rec = MeetingRecordingEntity.create(base);
    rec.markTranscribing();
    expect(rec.status).toBe('transcribing');

    rec.attachTranscript(
      'hello world',
      [{ text: 'hello world', startMs: 0, endMs: 1200 }],
      1200,
    );
    expect(rec.status).toBe('summarizing');
    expect(rec.transcriptText).toBe('hello world');
    expect(rec.transcriptSegments).toHaveLength(1);
    expect(rec.durationMs).toBe(1200);

    rec.attachSummary('- did stuff', 'You are summarizing…');
    expect(rec.status).toBe('ready');
    expect(rec.summary).toBe('- did stuff');
    expect(rec.promptUsed).toBe('You are summarizing…');
  });

  it('replaceSummary updates summary without re-marking ready or touching journal', () => {
    const rec = MeetingRecordingEntity.create(base);
    rec.markTranscribing();
    rec.attachTranscript('t', [], 100);
    rec.attachSummary('first', 'P1');
    rec.markJournaledFor('2026-05-27');

    rec.replaceSummary('second', 'P2');
    expect(rec.status).toBe('ready');
    expect(rec.summary).toBe('second');
    expect(rec.promptUsed).toBe('P2');
    expect(rec.journalDate).toBe('2026-05-27'); // unchanged by re-summarize
  });

  it('markJournaledFor rejects non-ISO dates', () => {
    const rec = MeetingRecordingEntity.create(base);
    expect(() => rec.markJournaledFor('27/05/2026')).toThrow(MeetingRecordingValidationError);
    expect(() => rec.markJournaledFor('2026-5-27')).toThrow(MeetingRecordingValidationError);
  });

  it('markFailed surfaces the error and transitions status', () => {
    const rec = MeetingRecordingEntity.create(base);
    rec.markFailed('whisper crashed');
    expect(rec.status).toBe('failed');
    expect(rec.error).toBe('whisper crashed');
  });

  it('rename trims and rejects empty titles', () => {
    const rec = MeetingRecordingEntity.create(base);
    rec.rename('  New name  ');
    expect(rec.title).toBe('New name');
    expect(() => rec.rename('   ')).toThrow(MeetingRecordingValidationError);
  });

  it('clearAudio drops the path so the orphan-cleanup pass leaves it alone', () => {
    const rec = MeetingRecordingEntity.create(base);
    rec.clearAudio();
    expect(rec.audioPath).toBeNull();
  });

  it('toPersistence returns a deep-ish snapshot', () => {
    const rec = MeetingRecordingEntity.create(base);
    const props = rec.toPersistence();
    props.transcriptSegments.push({ text: 'mutated', startMs: 0, endMs: 1 });
    expect(rec.transcriptSegments).toHaveLength(0);
  });
});
