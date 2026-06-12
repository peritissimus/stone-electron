import { describe, expect, it } from 'vitest';
import { TopicClassifier } from '../../../../src/main/domain/services/TopicClassifier';

describe('TopicClassifier', () => {
  it('returns sorted matches above the confidence threshold', () => {
    const matches = TopicClassifier.classify(
      [1, 0],
      [
        { topicId: 'strong', topicName: 'Strong', centroid: [1, 0] },
        { topicId: 'weak', topicName: 'Weak', centroid: [0.4, 0.6] },
        { topicId: 'opposite', topicName: 'Opposite', centroid: [-1, 0] },
      ],
      0.5,
    );

    expect(matches.map((match) => match.topicId)).toEqual(['strong', 'weak']);
    expect(matches[0].confidence).toBeGreaterThan(matches[1].confidence);
  });
});
