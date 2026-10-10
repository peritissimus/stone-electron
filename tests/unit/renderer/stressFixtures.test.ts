import { describe, expect, it } from 'vitest';
import { createStressFixture, type StressScenario } from '@renderer/dev/stress/fixtures';
import { DailyReviewSnapshotSchema } from '@shared/schemas/dailyReview';
import { NoteSchema } from '@shared/schemas/notes';

const scenarios: StressScenario[] = [
  'demo',
  'worst',
  'empty',
  'one',
  'huge',
  'loading',
  'error',
  'denied',
];

describe('main-screen stress fixtures', () => {
  it.each(scenarios)('%s respects read contracts and has unique note identities', (scenario) => {
    const fixture = createStressFixture(scenario);
    expect(DailyReviewSnapshotSchema.safeParse(fixture.snapshot).success).toBe(true);
    for (const note of fixture.notes) expect(NoteSchema.safeParse(note).success).toBe(true);
    expect(new Set(fixture.notes.map((note) => note.id)).size).toBe(fixture.notes.length);
  });

  it('keeps preview mutations out of later dataset selections', () => {
    const fixture = createStressFixture('worst');
    fixture.notes[0].title = 'Changed locally';
    fixture.tree.length = 0;
    const fresh = createStressFixture('worst');
    expect(fresh.notes[0].title).toHaveLength(255);
    expect(fresh.tree.length).toBeGreaterThan(0);
    expect(createStressFixture('huge').notes).toHaveLength(1284);
    expect(createStressFixture('empty').notes).toHaveLength(0);
    expect(createStressFixture('one').notes).toHaveLength(1);
  });
});
