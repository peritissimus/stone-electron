/**
 * NotebookRepository Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/testDatabase';
import { NotebookRepository } from '../../src/main/repositories/NotebookRepository';
import { WorkspaceRepository } from '../../src/main/repositories/WorkspaceRepository';
import path from 'path';
import fs from 'fs';

// Mock BrowserWindow for events
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

describe('NotebookRepository', () => {
  let cleanup: () => Promise<void>;
  let notebookRepo: NotebookRepository;
  let workspaceRepo: WorkspaceRepository;
  let testWorkspacePath: string;
  let workspaceId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;
    notebookRepo = new NotebookRepository();
    workspaceRepo = new WorkspaceRepository();

    // Create test workspace folder and workspace
    testWorkspacePath = path.join(process.cwd(), 'tests', 'tmp', 'notebook-workspace-' + Date.now());
    fs.mkdirSync(testWorkspacePath, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Notebook Test Workspace',
      folderPath: testWorkspacePath,
    });
    workspaceId = workspace.id;

    // Set as active workspace
    await workspaceRepo.setActive(workspace.id);
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true });
    }
    await cleanup();
  });

  describe('create', () => {
    it('should create a notebook with name', async () => {
      const notebook = await notebookRepo.create({
        name: 'Test Notebook',
        workspaceId,
      });

      expect(notebook.id).toBeDefined();
      expect(notebook.name).toBe('Test Notebook');
      expect(notebook.workspaceId).toBe(workspaceId);
      expect(notebook.folderPath).toBeDefined();
      expect(notebook.icon).toBe('📁');
      expect(notebook.createdAt).toBeDefined();
    });

    it('should create a notebook with custom icon and color', async () => {
      const notebook = await notebookRepo.create({
        name: 'Custom Notebook',
        workspaceId,
        icon: '📚',
        color: '#ff5500',
      });

      expect(notebook.icon).toBe('📚');
      expect(notebook.color).toBe('#ff5500');
    });

    it('should create a nested notebook with parentId', async () => {
      const parent = await notebookRepo.create({
        name: 'Parent Notebook',
        workspaceId,
      });

      const child = await notebookRepo.create({
        name: 'Child Notebook',
        parentId: parent.id,
        workspaceId,
      });

      expect(child.parentId).toBe(parent.id);
      expect(child.folderPath).toContain(parent.name);
    });

    it('should throw error if parent notebook not found', async () => {
      await expect(
        notebookRepo.create({
          name: 'Orphan',
          parentId: 'non-existent-parent',
          workspaceId,
        })
      ).rejects.toThrow('Parent notebook not found');
    });
  });

  describe('findById', () => {
    it('should find notebook by id', async () => {
      const created = await notebookRepo.create({
        name: 'Find By ID Test',
        workspaceId,
      });
      const found = await notebookRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Find By ID Test');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await notebookRepo.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('findByIds', () => {
    it('should find multiple notebooks by ids', async () => {
      const nb1 = await notebookRepo.create({ name: 'Bulk Test 1', workspaceId });
      const nb2 = await notebookRepo.create({ name: 'Bulk Test 2', workspaceId });

      const result = await notebookRepo.findByIds([nb1.id, nb2.id]);

      expect(result.size).toBe(2);
      expect(result.get(nb1.id)?.name).toBe('Bulk Test 1');
      expect(result.get(nb2.id)?.name).toBe('Bulk Test 2');
    });

    it('should return empty map for empty ids array', async () => {
      const result = await notebookRepo.findByIds([]);
      expect(result.size).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all notebooks', async () => {
      const notebooks = await notebookRepo.findAll();
      expect(Array.isArray(notebooks)).toBe(true);
    });

    it('should filter by parentId null for root notebooks', async () => {
      const notebooks = await notebookRepo.findAll({
        where: { parentId: null },
      });
      expect(Array.isArray(notebooks)).toBe(true);
      notebooks.forEach((nb) => {
        expect(nb.parentId).toBeNull();
      });
    });

    it('should apply sorting', async () => {
      const notebooks = await notebookRepo.findAll({
        sort: { field: 'name', order: 'ASC' },
      });
      expect(Array.isArray(notebooks)).toBe(true);
    });

    it('should apply limit', async () => {
      const notebooks = await notebookRepo.findAll({ limit: 3 });
      expect(notebooks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('update', () => {
    it('should update notebook name', async () => {
      const created = await notebookRepo.create({
        name: 'Update Test',
        workspaceId,
      });
      const updated = await notebookRepo.update(created.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(created.id);
    });

    it('should update notebook icon', async () => {
      const created = await notebookRepo.create({
        name: 'Icon Update Test',
        workspaceId,
      });
      const updated = await notebookRepo.update(created.id, { icon: '🎯' });

      expect(updated.icon).toBe('🎯');
    });

    it('should throw error for non-existent notebook', async () => {
      await expect(
        notebookRepo.update('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Notebook not found');
    });
  });

  describe('delete', () => {
    it('should delete a notebook', async () => {
      const created = await notebookRepo.create({
        name: 'Delete Test',
        workspaceId,
      });
      const result = await notebookRepo.delete(created.id);

      expect(result).toBe(true);

      const found = await notebookRepo.findById(created.id);
      expect(found).toBeUndefined();
    });
  });

  describe('getRoots', () => {
    it('should return only root notebooks', async () => {
      const roots = await notebookRepo.getRoots();
      expect(Array.isArray(roots)).toBe(true);
      roots.forEach((nb) => {
        expect(nb.parentId).toBeNull();
      });
    });
  });

  describe('getChildren', () => {
    it('should return children of a notebook', async () => {
      const parent = await notebookRepo.create({
        name: 'Parent For Children',
        workspaceId,
      });
      await notebookRepo.create({
        name: 'Child 1',
        parentId: parent.id,
        workspaceId,
      });
      await notebookRepo.create({
        name: 'Child 2',
        parentId: parent.id,
        workspaceId,
      });

      const children = await notebookRepo.getChildren(parent.id);

      expect(children.length).toBe(2);
      children.forEach((child) => {
        expect(child.parentId).toBe(parent.id);
      });
    });

    it('should return empty array for notebook without children', async () => {
      const leaf = await notebookRepo.create({
        name: 'Leaf Notebook',
        workspaceId,
      });

      const children = await notebookRepo.getChildren(leaf.id);
      expect(children).toEqual([]);
    });
  });

  describe('getTree', () => {
    it('should return hierarchical tree structure', async () => {
      const tree = await notebookRepo.getTree();
      expect(Array.isArray(tree)).toBe(true);
    });
  });

  describe('getNoteCount', () => {
    it('should return 0 for notebook without notes', async () => {
      const notebook = await notebookRepo.create({
        name: 'Empty Notebook',
        workspaceId,
      });

      const count = await notebookRepo.getNoteCount(notebook.id);
      expect(count).toBe(0);
    });

    it('should support includeSubNotebooks option', async () => {
      const parent = await notebookRepo.create({
        name: 'Parent Count',
        workspaceId,
      });

      const count = await notebookRepo.getNoteCount(parent.id, true);
      expect(typeof count).toBe('number');
    });
  });

  describe('move', () => {
    it('should move notebook to new parent', async () => {
      const nb = await notebookRepo.create({
        name: 'Moveable',
        workspaceId,
      });
      const newParent = await notebookRepo.create({
        name: 'New Parent',
        workspaceId,
      });

      const moved = await notebookRepo.move(nb.id, newParent.id);

      expect(moved.parentId).toBe(newParent.id);
    });

    it('should move notebook to root', async () => {
      const parent = await notebookRepo.create({
        name: 'Temp Parent',
        workspaceId,
      });
      const child = await notebookRepo.create({
        name: 'Child To Move',
        parentId: parent.id,
        workspaceId,
      });

      const moved = await notebookRepo.move(child.id, null);

      expect(moved.parentId).toBeNull();
    });

    it('should throw error when moving into itself', async () => {
      const nb = await notebookRepo.create({
        name: 'Self Move',
        workspaceId,
      });

      await expect(notebookRepo.move(nb.id, nb.id)).rejects.toThrow(
        'Cannot move notebook into itself or its descendants'
      );
    });

    it('should throw error when moving into descendant', async () => {
      const parent = await notebookRepo.create({
        name: 'Ancestor',
        workspaceId,
      });
      const child = await notebookRepo.create({
        name: 'Descendant',
        parentId: parent.id,
        workspaceId,
      });

      await expect(notebookRepo.move(parent.id, child.id)).rejects.toThrow(
        'Cannot move notebook into itself or its descendants'
      );
    });
  });

  describe('getFlatList', () => {
    it('should return flat list of all notebooks', async () => {
      const list = await notebookRepo.getFlatList();
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe('transaction', () => {
    it('should execute operations in transaction', async () => {
      const result = await notebookRepo.transaction(async () => {
        return 'transaction-result';
      });
      expect(result).toBe('transaction-result');
    });
  });
});
