import { describe, expect, it } from 'vitest';
import { TopicCurator } from '../../../../src/main/domain/services/TopicCurator';
import type { CuratorCluster } from '../../../../src/main/domain/services/TopicCurator';

function cluster(overrides: Partial<CuratorCluster> = {}): CuratorCluster {
  return {
    label: 'Release Planning',
    altLabels: ['Ship Dates'],
    noteIds: ['note-1', 'note-2', 'note-3'],
    noteCount: 3,
    cohesion: 0.8,
    ...overrides,
  };
}

describe('TopicCurator', () => {
  it('promotes clusters that are tight enough and span enough notes', () => {
    const curated = TopicCurator.curate([cluster()], []);

    expect(curated).toHaveLength(1);
    expect(curated[0].name).toBe('Release Planning');
    expect(curated[0].noteIds).toEqual(['note-1', 'note-2', 'note-3']);
    expect(curated[0].confidence).toBeCloseTo(0.8);
  });

  it('rejects loose clusters and clusters that span too few notes', () => {
    const loose = cluster({ label: 'Loose', cohesion: 0.4 });
    const tiny = cluster({ label: 'Tiny', noteIds: ['note-9'], noteCount: 1 });

    expect(TopicCurator.curate([loose, tiny], [])).toEqual([]);
  });

  it('falls back to an alternate label when the primary name is taken', () => {
    const curated = TopicCurator.curate([cluster()], [{ name: 'release planning' }]);

    expect(curated).toHaveLength(1);
    expect(curated[0].name).toBe('Ship Dates');
  });

  it('drops a cluster whose every candidate name already exists', () => {
    const curated = TopicCurator.curate([cluster()], [
      { name: 'Release Planning' },
      { name: 'Ship Dates' },
    ]);

    expect(curated).toEqual([]);
  });

  it('never promotes two clusters to the same name in one pass', () => {
    const curated = TopicCurator.curate(
      [cluster({ cohesion: 0.9 }), cluster({ cohesion: 0.85 })],
      [],
    );

    expect(curated.map((topic) => topic.name)).toEqual([
      'Release Planning',
      'Ship Dates',
    ]);
  });

  it('caps how many topics a single pass creates, tightest first', () => {
    const clusters = [
      cluster({ label: 'A', altLabels: [], cohesion: 0.7 }),
      cluster({ label: 'B', altLabels: [], cohesion: 0.9 }),
      cluster({ label: 'C', altLabels: [], cohesion: 0.8 }),
      cluster({ label: 'D', altLabels: [], cohesion: 0.75 }),
    ];

    const curated = TopicCurator.curate(clusters, []);

    expect(curated.map((topic) => topic.name)).toEqual(['B', 'C', 'D']);
  });

  it('stops creating topics once the workspace total is reached', () => {
    const existing = Array.from({ length: 24 }, (_, i) => ({ name: `Topic ${i}` }));

    expect(TopicCurator.curate([cluster()], existing)).toEqual([]);
  });

  it('assigns a stable color per name', () => {
    const first = TopicCurator.curate([cluster()], [])[0];
    const second = TopicCurator.curate([cluster()], [])[0];

    expect(first.color).toBe(second.color);
    expect(first.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
