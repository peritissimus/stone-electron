/**
 * WorkspaceEntity Domain Entity Tests
 *
 * Tests business rules and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceEntity } from '../../../../src/main/domain/entities/Workspace';
import { WorkspaceValidationError } from '../../../../src/main/domain/errors';

describe('WorkspaceEntity', () => {
  describe('create', () => {
    it('creates workspace with required props', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'My Workspace',
        folderPath: '/path/to/workspace',
      });

      expect(workspace.id).toBe('ws-1');
      expect(workspace.name).toBe('My Workspace');
      expect(workspace.folderPath).toBe('/path/to/workspace');
    });

    it('sets default values', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });

      expect(workspace.isActive).toBe(false);
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.lastAccessedAt).toBeInstanceOf(Date);
    });

    it('allows setting isActive on create', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
        isActive: true,
      });

      expect(workspace.isActive).toBe(true);
    });

    it('trims name and folderPath', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: '  My Workspace  ',
        folderPath: '  /path/to/workspace  ',
      });

      expect(workspace.name).toBe('My Workspace');
      expect(workspace.folderPath).toBe('/path/to/workspace');
    });

    it('throws on empty id', () => {
      expect(() =>
        WorkspaceEntity.create({
          id: '',
          name: 'Test',
          folderPath: '/path',
        })
      ).toThrow(WorkspaceValidationError);
    });

    it('throws on empty name', () => {
      expect(() =>
        WorkspaceEntity.create({
          id: 'ws-1',
          name: '',
          folderPath: '/path',
        })
      ).toThrow(WorkspaceValidationError);
    });

    it('throws on empty folderPath', () => {
      expect(() =>
        WorkspaceEntity.create({
          id: 'ws-1',
          name: 'Test',
          folderPath: '',
        })
      ).toThrow(WorkspaceValidationError);
    });
  });

  describe('rename', () => {
    let workspace: WorkspaceEntity;

    beforeEach(() => {
      workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Original',
        folderPath: '/path',
      });
    });

    it('renames workspace', () => {
      workspace.rename('New Name');

      expect(workspace.name).toBe('New Name');
    });

    it('trims new name', () => {
      workspace.rename('  Trimmed  ');

      expect(workspace.name).toBe('Trimmed');
    });

    it('throws on empty name', () => {
      expect(() => workspace.rename('')).toThrow(WorkspaceValidationError);
      expect(() => workspace.rename('   ')).toThrow(WorkspaceValidationError);
    });

    it('throws on name exceeding max length', () => {
      const longName = 'a'.repeat(101);

      expect(() => workspace.rename(longName)).toThrow(WorkspaceValidationError);
    });

    it('allows name at max length', () => {
      const maxName = 'a'.repeat(100);

      workspace.rename(maxName);

      expect(workspace.name).toBe(maxName);
    });
  });

  describe('activate', () => {
    it('activates workspace', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });

      workspace.activate();

      expect(workspace.isActive).toBe(true);
    });

    it('updates lastAccessedAt', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });
      const before = workspace.lastAccessedAt;

      workspace.activate();

      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('deactivate', () => {
    it('deactivates workspace', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
        isActive: true,
      });

      workspace.deactivate();

      expect(workspace.isActive).toBe(false);
    });
  });

  describe('recordAccess', () => {
    it('updates lastAccessedAt', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });
      const before = workspace.lastAccessedAt;

      workspace.recordAccess();

      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('updateFolderPath', () => {
    let workspace: WorkspaceEntity;

    beforeEach(() => {
      workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/original/path',
      });
    });

    it('updates folder path', () => {
      workspace.updateFolderPath('/new/path');

      expect(workspace.folderPath).toBe('/new/path');
    });

    it('trims new path', () => {
      workspace.updateFolderPath('  /new/path  ');

      expect(workspace.folderPath).toBe('/new/path');
    });

    it('throws on empty path', () => {
      expect(() => workspace.updateFolderPath('')).toThrow(WorkspaceValidationError);
      expect(() => workspace.updateFolderPath('   ')).toThrow(WorkspaceValidationError);
    });
  });

  describe('getRelativePath', () => {
    let workspace: WorkspaceEntity;

    beforeEach(() => {
      workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/home/user/workspace',
      });
    });

    it('returns relative path for file inside workspace', () => {
      const result = workspace.getRelativePath('/home/user/workspace/notes/file.md');

      expect(result).toBe('notes/file.md');
    });

    it('returns null for file outside workspace', () => {
      const result = workspace.getRelativePath('/other/path/file.md');

      expect(result).toBeNull();
    });

    it('handles path at workspace root', () => {
      const result = workspace.getRelativePath('/home/user/workspace/file.md');

      expect(result).toBe('file.md');
    });
  });

  describe('getAbsolutePath', () => {
    let workspace: WorkspaceEntity;

    beforeEach(() => {
      workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/home/user/workspace',
      });
    });

    it('returns absolute path for relative path', () => {
      const result = workspace.getAbsolutePath('notes/file.md');

      expect(result).toBe('/home/user/workspace/notes/file.md');
    });

    it('handles leading slash in relative path', () => {
      const result = workspace.getAbsolutePath('/notes/file.md');

      expect(result).toBe('/home/user/workspace/notes/file.md');
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
        isActive: true,
      });

      const data = workspace.toPersistence();

      expect(data).toMatchObject({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
        isActive: true,
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'ws-1',
        name: 'Persisted',
        folderPath: '/path',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastAccessedAt: new Date('2024-01-02'),
      };

      const workspace = WorkspaceEntity.fromPersistence(data);

      expect(workspace.id).toBe('ws-1');
      expect(workspace.name).toBe('Persisted');
      expect(workspace.isActive).toBe(true);
      expect(workspace.createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('toJSON', () => {
    it('converts to JSON format', () => {
      const workspace = WorkspaceEntity.create({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });

      const json = workspace.toJSON();

      expect(json).toMatchObject({
        id: 'ws-1',
        name: 'Test',
        folderPath: '/path',
      });
    });
  });
});
