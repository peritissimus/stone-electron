/**
 * TopicEntity Domain Entity Tests
 *
 * Tests business rules and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TopicEntity } from '../../../../src/main/domain/entities/Topic';
import { TopicValidationError } from '../../../../src/main/domain/errors';

describe('TopicEntity', () => {
  describe('create', () => {
    it('creates topic with required props', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Machine Learning',
      });

      expect(topic.id).toBe('topic-1');
      expect(topic.name).toBe('Machine Learning');
    });

    it('creates topic with all props', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Machine Learning',
        description: 'Notes about ML',
        color: '#ff5500',
        isPredefined: true,
      });

      expect(topic.description).toBe('Notes about ML');
      expect(topic.color).toBe('#ff5500');
      expect(topic.isPredefined).toBe(true);
    });

    it('sets default values', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
      });

      expect(topic.description).toBeNull();
      expect(topic.color).toBe('#6366f1'); // Default color
      expect(topic.isPredefined).toBe(false);
      expect(topic.centroid).toBeNull();
      expect(topic.noteCount).toBe(0);
      expect(topic.createdAt).toBeInstanceOf(Date);
      expect(topic.updatedAt).toBeInstanceOf(Date);
    });

    it('trims name and description', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: '  Machine Learning  ',
        description: '  Notes about ML  ',
      });

      expect(topic.name).toBe('Machine Learning');
      expect(topic.description).toBe('Notes about ML');
    });

    it('throws on empty id', () => {
      expect(() =>
        TopicEntity.create({
          id: '',
          name: 'Test',
        })
      ).toThrow(TopicValidationError);
    });

    it('throws on empty name', () => {
      expect(() =>
        TopicEntity.create({
          id: 'topic-1',
          name: '',
        })
      ).toThrow(TopicValidationError);
    });

    it('throws on invalid color', () => {
      expect(() =>
        TopicEntity.create({
          id: 'topic-1',
          name: 'Test',
          color: 'red',
        })
      ).toThrow(TopicValidationError);
    });
  });

  describe('rename', () => {
    let topic: TopicEntity;

    beforeEach(() => {
      topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Original',
      });
    });

    it('renames topic', () => {
      topic.rename('New Name');

      expect(topic.name).toBe('New Name');
    });

    it('trims new name', () => {
      topic.rename('  Trimmed  ');

      expect(topic.name).toBe('Trimmed');
    });

    it('updates timestamp', () => {
      const before = topic.updatedAt;
      topic.rename('New Name');

      expect(topic.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws on empty name', () => {
      expect(() => topic.rename('')).toThrow(TopicValidationError);
      expect(() => topic.rename('   ')).toThrow(TopicValidationError);
    });
  });

  describe('updateDescription', () => {
    let topic: TopicEntity;

    beforeEach(() => {
      topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
      });
    });

    it('updates description', () => {
      topic.updateDescription('New description');

      expect(topic.description).toBe('New description');
    });

    it('trims description', () => {
      topic.updateDescription('  Trimmed  ');

      expect(topic.description).toBe('Trimmed');
    });

    it('allows null description', () => {
      topic.updateDescription('Some text');
      topic.updateDescription(null);

      expect(topic.description).toBeNull();
    });

    it('updates timestamp', () => {
      const before = topic.updatedAt;
      topic.updateDescription('New description');

      expect(topic.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('changeColor', () => {
    let topic: TopicEntity;

    beforeEach(() => {
      topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
      });
    });

    it('changes color', () => {
      topic.changeColor('#ff5500');

      expect(topic.color).toBe('#ff5500');
    });

    it('updates timestamp', () => {
      const before = topic.updatedAt;
      topic.changeColor('#ff5500');

      expect(topic.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws on invalid color format', () => {
      expect(() => topic.changeColor('red')).toThrow(TopicValidationError);
      expect(() => topic.changeColor('#fff')).toThrow(TopicValidationError);
      expect(() => topic.changeColor('ff5500')).toThrow(TopicValidationError);
    });
  });

  describe('updateCentroid', () => {
    it('updates centroid', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
      });
      const centroid = new Uint8Array([1, 2, 3, 4]);

      topic.updateCentroid(centroid);

      expect(topic.centroid).toEqual(centroid);
    });
  });

  describe('note count operations', () => {
    let topic: TopicEntity;

    beforeEach(() => {
      topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
      });
    });

    it('increments note count', () => {
      topic.incrementNoteCount();

      expect(topic.noteCount).toBe(1);
    });

    it('decrements note count', () => {
      topic.setNoteCount(5);
      topic.decrementNoteCount();

      expect(topic.noteCount).toBe(4);
    });

    it('does not decrement below zero', () => {
      topic.decrementNoteCount();

      expect(topic.noteCount).toBe(0);
    });

    it('sets note count', () => {
      topic.setNoteCount(10);

      expect(topic.noteCount).toBe(10);
    });

    it('clamps negative count to zero', () => {
      topic.setNoteCount(-5);

      expect(topic.noteCount).toBe(0);
    });
  });

  describe('canDelete', () => {
    it('returns true for non-predefined topic', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Custom',
        isPredefined: false,
      });

      expect(topic.canDelete()).toBe(true);
    });

    it('returns false for predefined topic', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Predefined',
        isPredefined: true,
      });

      expect(topic.canDelete()).toBe(false);
    });
  });

  describe('static helpers', () => {
    describe('normalizeName', () => {
      it('trims whitespace', () => {
        expect(TopicEntity.normalizeName('  test  ')).toBe('test');
      });
    });

    describe('isValidColor', () => {
      it('returns true for valid hex colors', () => {
        expect(TopicEntity.isValidColor('#ff5500')).toBe(true);
        expect(TopicEntity.isValidColor('#FF5500')).toBe(true);
        expect(TopicEntity.isValidColor('#000000')).toBe(true);
      });

      it('returns false for invalid colors', () => {
        expect(TopicEntity.isValidColor('red')).toBe(false);
        expect(TopicEntity.isValidColor('#fff')).toBe(false);
        expect(TopicEntity.isValidColor('ff5500')).toBe(false);
      });
    });

    describe('getDefaultColor', () => {
      it('returns default color', () => {
        expect(TopicEntity.getDefaultColor()).toBe('#6366f1');
      });
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const topic = TopicEntity.create({
        id: 'topic-1',
        name: 'Test',
        description: 'Description',
        color: '#ff5500',
        isPredefined: true,
      });

      const data = topic.toPersistence();

      expect(data).toMatchObject({
        id: 'topic-1',
        name: 'Test',
        description: 'Description',
        color: '#ff5500',
        isPredefined: true,
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'topic-1',
        name: 'Persisted',
        description: 'Description',
        color: '#ff5500',
        isPredefined: true,
        centroid: null,
        noteCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const topic = TopicEntity.fromPersistence(data);

      expect(topic.id).toBe('topic-1');
      expect(topic.name).toBe('Persisted');
      expect(topic.noteCount).toBe(5);
      expect(topic.createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
