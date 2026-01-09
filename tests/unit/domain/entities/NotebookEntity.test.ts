/**
 * NotebookEntity Domain Entity Tests
 *
 * Tests business rules and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotebookEntity } from '../../../../src/main/domain/entities/Notebook';
import { NotebookValidationError, NotebookOperationError } from '../../../../src/main/domain/errors';

describe('NotebookEntity', () => {
  describe('create', () => {
    it('creates notebook with required props', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'My Notebook',
      });

      expect(notebook.id).toBe('nb-1');
      expect(notebook.name).toBe('My Notebook');
    });

    it('creates notebook with all props', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'My Notebook',
        parentId: 'parent-1',
        workspaceId: 'ws-1',
        folderPath: '/notebooks/my-notebook',
        icon: '📚',
        color: '#ff5500',
        position: 5,
      });

      expect(notebook.parentId).toBe('parent-1');
      expect(notebook.workspaceId).toBe('ws-1');
      expect(notebook.folderPath).toBe('/notebooks/my-notebook');
      expect(notebook.icon).toBe('📚');
      expect(notebook.color).toBe('#ff5500');
      expect(notebook.position).toBe(5);
    });

    it('sets default values', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });

      expect(notebook.parentId).toBeNull();
      expect(notebook.workspaceId).toBeNull();
      expect(notebook.folderPath).toBeNull();
      expect(notebook.icon).toBe('📁');
      expect(notebook.color).toBe('#3b82f6');
      expect(notebook.position).toBe(0);
      expect(notebook.createdAt).toBeInstanceOf(Date);
      expect(notebook.updatedAt).toBeInstanceOf(Date);
    });

    it('trims name', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: '  My Notebook  ',
      });

      expect(notebook.name).toBe('My Notebook');
    });

    it('throws on empty id', () => {
      expect(() =>
        NotebookEntity.create({
          id: '',
          name: 'Test',
        })
      ).toThrow(NotebookValidationError);
    });

    it('throws on empty name', () => {
      expect(() =>
        NotebookEntity.create({
          id: 'nb-1',
          name: '',
        })
      ).toThrow(NotebookValidationError);
    });
  });

  describe('isRoot', () => {
    it('returns true for notebook without parent', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Root Notebook',
      });

      expect(notebook.isRoot).toBe(true);
    });

    it('returns false for notebook with parent', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Child Notebook',
        parentId: 'parent-1',
      });

      expect(notebook.isRoot).toBe(false);
    });
  });

  describe('rename', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Original',
      });
    });

    it('renames notebook', () => {
      notebook.rename('New Name');

      expect(notebook.name).toBe('New Name');
    });

    it('trims new name', () => {
      notebook.rename('  Trimmed  ');

      expect(notebook.name).toBe('Trimmed');
    });

    it('updates timestamp', () => {
      const before = notebook.updatedAt;
      notebook.rename('New Name');

      expect(notebook.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws on empty name', () => {
      expect(() => notebook.rename('')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('   ')).toThrow(NotebookValidationError);
    });

    it('throws on name exceeding max length', () => {
      const longName = 'a'.repeat(101);

      expect(() => notebook.rename(longName)).toThrow(NotebookValidationError);
    });

    it('allows name at max length', () => {
      const maxName = 'a'.repeat(100);

      notebook.rename(maxName);

      expect(notebook.name).toBe(maxName);
    });

    it('throws on invalid characters', () => {
      expect(() => notebook.rename('test<name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test>name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test:name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test"name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test/name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test\\name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test|name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test?name')).toThrow(NotebookValidationError);
      expect(() => notebook.rename('test*name')).toThrow(NotebookValidationError);
    });
  });

  describe('moveTo', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
        parentId: 'parent-1',
      });
    });

    it('moves notebook to different parent', () => {
      notebook.moveTo('parent-2');

      expect(notebook.parentId).toBe('parent-2');
    });

    it('allows moving to root (null parent)', () => {
      notebook.moveTo(null);

      expect(notebook.parentId).toBeNull();
    });

    it('updates timestamp', () => {
      const before = notebook.updatedAt;
      notebook.moveTo('parent-2');

      expect(notebook.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws when moving into itself', () => {
      expect(() => notebook.moveTo('nb-1')).toThrow(NotebookOperationError);
    });
  });

  describe('updateFolderPath', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });
    });

    it('updates folder path', () => {
      notebook.updateFolderPath('/new/path');

      expect(notebook.folderPath).toBe('/new/path');
    });

    it('updates timestamp', () => {
      const before = notebook.updatedAt;
      notebook.updateFolderPath('/new/path');

      expect(notebook.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('changeIcon', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });
    });

    it('changes icon', () => {
      notebook.changeIcon('📚');

      expect(notebook.icon).toBe('📚');
    });

    it('throws on empty icon', () => {
      expect(() => notebook.changeIcon('')).toThrow(NotebookValidationError);
      expect(() => notebook.changeIcon('   ')).toThrow(NotebookValidationError);
    });
  });

  describe('changeColor', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });
    });

    it('changes color', () => {
      notebook.changeColor('#ff5500');

      expect(notebook.color).toBe('#ff5500');
    });

    it('throws on invalid hex format', () => {
      expect(() => notebook.changeColor('red')).toThrow(NotebookValidationError);
      expect(() => notebook.changeColor('#fff')).toThrow(NotebookValidationError);
      expect(() => notebook.changeColor('ff5500')).toThrow(NotebookValidationError);
    });
  });

  describe('setPosition', () => {
    let notebook: NotebookEntity;

    beforeEach(() => {
      notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });
    });

    it('sets position', () => {
      notebook.setPosition(10);

      expect(notebook.position).toBe(10);
    });

    it('throws on negative position', () => {
      expect(() => notebook.setPosition(-1)).toThrow(NotebookValidationError);
    });
  });

  describe('canHaveParent', () => {
    it('returns false when parent would be itself', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });

      const result = notebook.canHaveParent('nb-1', () => []);

      expect(result).toBe(false);
    });

    it('returns false when would create circular reference', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });

      const getAncestors = () => ['nb-1', 'nb-2'];
      const result = notebook.canHaveParent('nb-3', getAncestors);

      expect(result).toBe(false);
    });

    it('returns true for valid parent', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
      });

      const getAncestors = () => ['nb-4', 'nb-5'];
      const result = notebook.canHaveParent('nb-3', getAncestors);

      expect(result).toBe(true);
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
        parentId: 'parent-1',
        icon: '📚',
        color: '#ff5500',
      });

      const data = notebook.toPersistence();

      expect(data).toMatchObject({
        id: 'nb-1',
        name: 'Test',
        parentId: 'parent-1',
        icon: '📚',
        color: '#ff5500',
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'nb-1',
        name: 'Persisted',
        parentId: 'parent-1',
        workspaceId: 'ws-1',
        folderPath: '/path',
        icon: '📚',
        color: '#ff5500',
        position: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const notebook = NotebookEntity.fromPersistence(data);

      expect(notebook.id).toBe('nb-1');
      expect(notebook.name).toBe('Persisted');
      expect(notebook.parentId).toBe('parent-1');
      expect(notebook.createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('toJSON', () => {
    it('converts to JSON format', () => {
      const notebook = NotebookEntity.create({
        id: 'nb-1',
        name: 'Test',
        workspaceId: 'ws-1',
        icon: '📚',
      });

      const json = notebook.toJSON();

      expect(json).toMatchObject({
        id: 'nb-1',
        name: 'Test',
        workspaceId: 'ws-1',
        icon: '📚',
      });
    });
  });
});
