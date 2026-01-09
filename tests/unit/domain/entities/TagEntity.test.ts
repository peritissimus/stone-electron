/**
 * TagEntity Domain Entity Tests
 *
 * Tests name normalization and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TagEntity } from '../../../../src/main/domain/entities/Tag';
import { TagValidationError } from '../../../../src/main/domain/errors';

describe('TagEntity', () => {
  describe('create', () => {
    it('creates tag with required props', () => {
      const tag = TagEntity.create({
        id: 'tag-1',
        name: 'my-tag',
      });

      expect(tag.id).toBe('tag-1');
      expect(tag.name).toBe('my-tag');
    });

    it('normalizes name on create', () => {
      const tag = TagEntity.create({
        id: 'tag-1',
        name: 'My Tag',
      });

      expect(tag.name).toBe('my-tag'); // lowercase + space to dash
    });

    it('sets default color if not provided', () => {
      const tag = TagEntity.create({
        id: 'tag-1',
        name: 'test',
      });

      expect(tag.color).toBeDefined();
    });

    it('throws on empty id', () => {
      expect(() =>
        TagEntity.create({
          id: '',
          name: 'test',
        })
      ).toThrow(TagValidationError);
    });

    it('throws on empty name after normalization', () => {
      expect(() =>
        TagEntity.create({
          id: 'tag-1',
          name: '!!!',
        })
      ).toThrow(TagValidationError);
    });
  });

  describe('normalizeName', () => {
    it('converts to lowercase', () => {
      expect(TagEntity.normalizeName('MyTag')).toBe('mytag');
    });

    it('trims whitespace', () => {
      expect(TagEntity.normalizeName('  tag  ')).toBe('tag');
    });

    it('replaces spaces with dashes', () => {
      expect(TagEntity.normalizeName('my tag')).toBe('my-tag');
    });

    it('removes special characters', () => {
      expect(TagEntity.normalizeName('tag!@#$%')).toBe('tag');
    });

    it('preserves dashes and underscores', () => {
      expect(TagEntity.normalizeName('my-tag_name')).toBe('my-tag_name');
    });

    it('handles multiple spaces', () => {
      expect(TagEntity.normalizeName('my   tag')).toBe('my-tag');
    });

    it('handles complex input', () => {
      expect(TagEntity.normalizeName('  My Cool Tag!!! ')).toBe('my-cool-tag');
    });
  });

  describe('rename', () => {
    let tag: TagEntity;

    beforeEach(() => {
      tag = TagEntity.create({
        id: 'tag-1',
        name: 'original',
      });
    });

    it('renames tag', () => {
      tag.rename('new-name');

      expect(tag.name).toBe('new-name');
    });

    it('normalizes new name', () => {
      tag.rename('New Name');

      expect(tag.name).toBe('new-name');
    });

    it('updates timestamp', () => {
      const before = tag.updatedAt;
      tag.rename('new-name');

      expect(tag.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws on empty name', () => {
      expect(() => tag.rename('')).toThrow(TagValidationError);
    });

    it('throws on name exceeding max length', () => {
      const longName = 'a'.repeat(51);

      expect(() => tag.rename(longName)).toThrow(TagValidationError);
    });

    it('allows name at max length', () => {
      const maxName = 'a'.repeat(50);

      tag.rename(maxName);

      expect(tag.name).toBe(maxName);
    });
  });

  describe('changeColor', () => {
    let tag: TagEntity;

    beforeEach(() => {
      tag = TagEntity.create({
        id: 'tag-1',
        name: 'test',
      });
    });

    it('changes color', () => {
      tag.changeColor('#ff5500');

      expect(tag.color).toBe('#ff5500');
    });

    it('throws on invalid hex format', () => {
      expect(() => tag.changeColor('red')).toThrow(TagValidationError);
      expect(() => tag.changeColor('#fff')).toThrow(TagValidationError);
      expect(() => tag.changeColor('ff5500')).toThrow(TagValidationError);
    });

    it('allows valid hex formats', () => {
      tag.changeColor('#000000');
      expect(tag.color).toBe('#000000');

      tag.changeColor('#FFFFFF');
      expect(tag.color).toBe('#FFFFFF');
    });
  });

  describe('matches', () => {
    let tag: TagEntity;

    beforeEach(() => {
      tag = TagEntity.create({
        id: 'tag-1',
        name: 'my-test-tag',
      });
    });

    it('matches exact name', () => {
      expect(tag.matches('my-test-tag')).toBe(true);
    });

    it('matches partial name', () => {
      expect(tag.matches('test')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(tag.matches('TEST')).toBe(true);
      expect(tag.matches('My-Test')).toBe(true);
    });

    it('returns false for no match', () => {
      expect(tag.matches('other')).toBe(false);
    });

    it('returns true for empty search', () => {
      expect(tag.matches('')).toBe(true);
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const tag = TagEntity.create({
        id: 'tag-1',
        name: 'test',
        color: '#ff5500',
      });

      const data = tag.toPersistence();

      expect(data).toMatchObject({
        id: 'tag-1',
        name: 'test',
        color: '#ff5500',
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'tag-1',
        name: 'persisted',
        color: '#00ff00',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const tag = TagEntity.fromPersistence(data);

      expect(tag.id).toBe('tag-1');
      expect(tag.name).toBe('persisted');
      expect(tag.color).toBe('#00ff00');
    });

    it('preserves createdAt from persistence', () => {
      const createdDate = new Date('2024-01-01');
      const data = {
        id: 'tag-1',
        name: 'test',
        color: '#00ff00',
        createdAt: createdDate,
        updatedAt: new Date('2024-01-02'),
      };

      const tag = TagEntity.fromPersistence(data);

      expect(tag.createdAt).toEqual(createdDate);
    });
  });

  describe('toJSON', () => {
    it('converts to JSON format', () => {
      const tag = TagEntity.create({
        id: 'tag-1',
        name: 'test',
        color: '#ff5500',
      });

      const json = tag.toJSON();

      expect(json).toMatchObject({
        id: 'tag-1',
        name: 'test',
        color: '#ff5500',
      });
    });
  });
});
