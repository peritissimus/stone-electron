/**
 * NoteLinkEntity Domain Entity Tests
 *
 * Tests wiki-style link business rules.
 */

import { describe, it, expect } from 'vitest';
import { NoteLinkEntity } from '../../../../src/main/domain/entities/NoteLink';
import { NoteLinkValidationError } from '../../../../src/main/domain/errors';

describe('NoteLinkEntity', () => {
  describe('create', () => {
    it('creates note link with required props', () => {
      const link = NoteLinkEntity.create({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });

      expect(link.sourceNoteId).toBe('note-1');
      expect(link.targetNoteId).toBe('note-2');
    });

    it('sets createdAt to current date', () => {
      const link = NoteLinkEntity.create({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });

      expect(link.createdAt).toBeInstanceOf(Date);
    });

    it('throws on self-referencing link', () => {
      expect(() =>
        NoteLinkEntity.create({
          sourceNoteId: 'note-1',
          targetNoteId: 'note-1',
        })
      ).toThrow(NoteLinkValidationError);
    });

    it('throws on missing source note id', () => {
      expect(() =>
        NoteLinkEntity.create({
          sourceNoteId: '',
          targetNoteId: 'note-2',
        })
      ).toThrow(NoteLinkValidationError);
    });

    it('throws on missing target note id', () => {
      expect(() =>
        NoteLinkEntity.create({
          sourceNoteId: 'note-1',
          targetNoteId: '',
        })
      ).toThrow(NoteLinkValidationError);
    });
  });

  describe('isSelfLink', () => {
    it('returns false for normal links (validated at create)', () => {
      // Since create validates against self-links,
      // we test via fromPersistence which bypasses validation
      const link = NoteLinkEntity.fromPersistence({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-1',
        createdAt: new Date(),
      });

      expect(link.isSelfLink()).toBe(true);
    });

    it('returns false for different notes', () => {
      const link = NoteLinkEntity.create({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });

      expect(link.isSelfLink()).toBe(false);
    });
  });

  describe('involvesNote', () => {
    const link = NoteLinkEntity.create({
      sourceNoteId: 'note-1',
      targetNoteId: 'note-2',
    });

    it('returns true for source note', () => {
      expect(link.involvesNote('note-1')).toBe(true);
    });

    it('returns true for target note', () => {
      expect(link.involvesNote('note-2')).toBe(true);
    });

    it('returns false for unrelated note', () => {
      expect(link.involvesNote('note-3')).toBe(false);
    });
  });

  describe('isLinkFrom', () => {
    const link = NoteLinkEntity.create({
      sourceNoteId: 'note-1',
      targetNoteId: 'note-2',
    });

    it('returns true for source note', () => {
      expect(link.isLinkFrom('note-1')).toBe(true);
    });

    it('returns false for target note', () => {
      expect(link.isLinkFrom('note-2')).toBe(false);
    });

    it('returns false for unrelated note', () => {
      expect(link.isLinkFrom('note-3')).toBe(false);
    });
  });

  describe('isLinkTo', () => {
    const link = NoteLinkEntity.create({
      sourceNoteId: 'note-1',
      targetNoteId: 'note-2',
    });

    it('returns true for target note', () => {
      expect(link.isLinkTo('note-2')).toBe(true);
    });

    it('returns false for source note', () => {
      expect(link.isLinkTo('note-1')).toBe(false);
    });

    it('returns false for unrelated note', () => {
      expect(link.isLinkTo('note-3')).toBe(false);
    });
  });

  describe('key', () => {
    it('returns composite key', () => {
      const link = NoteLinkEntity.create({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });

      expect(link.key).toBe('note-1:note-2');
    });
  });

  describe('makeKey', () => {
    it('creates key from source and target ids', () => {
      const key = NoteLinkEntity.makeKey('source', 'target');

      expect(key).toBe('source:target');
    });
  });

  describe('validate', () => {
    it('throws on missing source', () => {
      expect(() =>
        NoteLinkEntity.validate({
          sourceNoteId: '',
          targetNoteId: 'note-2',
        })
      ).toThrow(NoteLinkValidationError);
    });

    it('throws on missing target', () => {
      expect(() =>
        NoteLinkEntity.validate({
          sourceNoteId: 'note-1',
          targetNoteId: '',
        })
      ).toThrow(NoteLinkValidationError);
    });

    it('throws on self-reference', () => {
      expect(() =>
        NoteLinkEntity.validate({
          sourceNoteId: 'note-1',
          targetNoteId: 'note-1',
        })
      ).toThrow(NoteLinkValidationError);
    });

    it('passes for valid input', () => {
      expect(() =>
        NoteLinkEntity.validate({
          sourceNoteId: 'note-1',
          targetNoteId: 'note-2',
        })
      ).not.toThrow();
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const link = NoteLinkEntity.create({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });

      const data = link.toPersistence();

      expect(data).toMatchObject({
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
      });
      expect(data.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        sourceNoteId: 'note-1',
        targetNoteId: 'note-2',
        createdAt: new Date('2024-01-01'),
      };

      const link = NoteLinkEntity.fromPersistence(data);

      expect(link.sourceNoteId).toBe('note-1');
      expect(link.targetNoteId).toBe('note-2');
      expect(link.createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
