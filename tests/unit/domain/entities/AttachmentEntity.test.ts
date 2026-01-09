/**
 * AttachmentEntity Domain Entity Tests
 *
 * Tests business rules and validation.
 */

import { describe, it, expect } from 'vitest';
import { AttachmentEntity } from '../../../../src/main/domain/entities/Attachment';
import { AttachmentValidationError } from '../../../../src/main/domain/errors';

describe('AttachmentEntity', () => {
  describe('create', () => {
    it('creates attachment with required props', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'image.png',
        mimeType: 'image/png',
        size: 1024,
        path: '/attachments/image.png',
      });

      expect(attachment.id).toBe('att-1');
      expect(attachment.noteId).toBe('note-1');
      expect(attachment.filename).toBe('image.png');
      expect(attachment.mimeType).toBe('image/png');
      expect(attachment.size).toBe(1024);
      expect(attachment.path).toBe('/attachments/image.png');
    });

    it('sets createdAt to current date', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        path: '/attachments/test.pdf',
      });

      expect(attachment.createdAt).toBeInstanceOf(Date);
    });

    it('trims filename', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: '  image.png  ',
        mimeType: 'image/png',
        size: 1024,
        path: '/path',
      });

      expect(attachment.filename).toBe('image.png');
    });

    it('throws on empty id', () => {
      expect(() =>
        AttachmentEntity.create({
          id: '',
          noteId: 'note-1',
          filename: 'test.png',
          mimeType: 'image/png',
          size: 1024,
          path: '/path',
        })
      ).toThrow(AttachmentValidationError);
    });

    it('throws on empty filename', () => {
      expect(() =>
        AttachmentEntity.create({
          id: 'att-1',
          noteId: 'note-1',
          filename: '',
          mimeType: 'image/png',
          size: 1024,
          path: '/path',
        })
      ).toThrow(AttachmentValidationError);
    });

    it('throws on path traversal in filename', () => {
      expect(() =>
        AttachmentEntity.create({
          id: 'att-1',
          noteId: 'note-1',
          filename: '../etc/passwd',
          mimeType: 'text/plain',
          size: 1024,
          path: '/path',
        })
      ).toThrow(AttachmentValidationError);
    });

    it('throws on forward slash in filename', () => {
      expect(() =>
        AttachmentEntity.create({
          id: 'att-1',
          noteId: 'note-1',
          filename: 'path/to/file.png',
          mimeType: 'image/png',
          size: 1024,
          path: '/path',
        })
      ).toThrow(AttachmentValidationError);
    });

    it('throws on backslash in filename', () => {
      expect(() =>
        AttachmentEntity.create({
          id: 'att-1',
          noteId: 'note-1',
          filename: 'path\\to\\file.png',
          mimeType: 'image/png',
          size: 1024,
          path: '/path',
        })
      ).toThrow(AttachmentValidationError);
    });
  });

  describe('isImage', () => {
    it('returns true for image mime types', () => {
      const pngAttachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'image.png',
        mimeType: 'image/png',
        size: 1024,
        path: '/path',
      });

      const jpegAttachment = AttachmentEntity.create({
        id: 'att-2',
        noteId: 'note-1',
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: '/path',
      });

      expect(pngAttachment.isImage).toBe(true);
      expect(jpegAttachment.isImage).toBe(true);
    });

    it('returns false for non-image mime types', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        path: '/path',
      });

      expect(attachment.isImage).toBe(false);
    });
  });

  describe('isPdf', () => {
    it('returns true for PDF mime type', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        path: '/path',
      });

      expect(attachment.isPdf).toBe(true);
    });

    it('returns false for non-PDF mime types', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'image.png',
        mimeType: 'image/png',
        size: 1024,
        path: '/path',
      });

      expect(attachment.isPdf).toBe(false);
    });
  });

  describe('extension', () => {
    it('returns file extension', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        path: '/path',
      });

      expect(attachment.extension).toBe('pdf');
    });

    it('returns lowercase extension', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'image.PNG',
        mimeType: 'image/png',
        size: 1024,
        path: '/path',
      });

      expect(attachment.extension).toBe('png');
    });

    it('returns empty string for file without extension', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'README',
        mimeType: 'text/plain',
        size: 1024,
        path: '/path',
      });

      expect(attachment.extension).toBe('');
    });

    it('handles multiple dots in filename', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'archive.tar.gz',
        mimeType: 'application/gzip',
        size: 1024,
        path: '/path',
      });

      expect(attachment.extension).toBe('gz');
    });
  });

  describe('formattedSize', () => {
    it('formats bytes', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'tiny.txt',
        mimeType: 'text/plain',
        size: 500,
        path: '/path',
      });

      expect(attachment.formattedSize).toBe('500 B');
    });

    it('formats kilobytes', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'small.txt',
        mimeType: 'text/plain',
        size: 1536, // 1.5 KB
        path: '/path',
      });

      expect(attachment.formattedSize).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'medium.pdf',
        mimeType: 'application/pdf',
        size: 2621440, // 2.5 MB
        path: '/path',
      });

      expect(attachment.formattedSize).toBe('2.5 MB');
    });

    it('formats gigabytes', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'large.zip',
        mimeType: 'application/zip',
        size: 1610612736, // 1.5 GB
        path: '/path',
      });

      expect(attachment.formattedSize).toBe('1.5 GB');
    });
  });

  describe('validateFilename', () => {
    it('throws on empty filename', () => {
      expect(() => AttachmentEntity.validateFilename('')).toThrow(AttachmentValidationError);
    });

    it('throws on path traversal', () => {
      expect(() => AttachmentEntity.validateFilename('../secret')).toThrow(AttachmentValidationError);
    });

    it('accepts valid filename', () => {
      expect(() => AttachmentEntity.validateFilename('valid-file.txt')).not.toThrow();
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const attachment = AttachmentEntity.create({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        path: '/attachments/test.pdf',
      });

      const data = attachment.toPersistence();

      expect(data).toMatchObject({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        path: '/attachments/test.pdf',
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'att-1',
        noteId: 'note-1',
        filename: 'persisted.png',
        mimeType: 'image/png',
        size: 2048,
        path: '/path/persisted.png',
        createdAt: new Date('2024-01-01'),
      };

      const attachment = AttachmentEntity.fromPersistence(data);

      expect(attachment.id).toBe('att-1');
      expect(attachment.filename).toBe('persisted.png');
      expect(attachment.createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
