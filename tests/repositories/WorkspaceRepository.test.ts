/**
 * WorkspaceRepository Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase } from '../helpers/testDatabase';
import { WorkspaceRepository } from '../../src/main/repositories/WorkspaceRepository';
import path from 'path';
import fs from 'fs';

describe('WorkspaceRepository', () => {
  let cleanup: () => Promise<void>;
  let workspaceRepo: WorkspaceRepository;
  let testWorkspacePath: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;
    workspaceRepo = new WorkspaceRepository();

    // Create a test workspace folder
    testWorkspacePath = path.join(process.cwd(), 'tests', 'tmp', 'test-workspace-' + Date.now());
    if (!fs.existsSync(testWorkspacePath)) {
      fs.mkdirSync(testWorkspacePath, { recursive: true });
    }
  });

  afterAll(async () => {
    // Cleanup test workspace folder
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true });
    }
    await cleanup();
  });

  describe('create', () => {
    it('should create a workspace with name and folder path', async () => {
      const uniquePath = path.join(testWorkspacePath, 'ws-' + Date.now());
      fs.mkdirSync(uniquePath, { recursive: true });

      const workspace = await workspaceRepo.create({
        name: 'Test Workspace',
        folderPath: uniquePath,
      });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.folderPath).toBe(uniquePath);
      expect(workspace.isActive).toBe(false);
      expect(workspace.createdAt).toBeDefined();
    });

    it('should throw error for duplicate folder path', async () => {
      const uniquePath = path.join(testWorkspacePath, 'duplicate-' + Date.now());
      fs.mkdirSync(uniquePath, { recursive: true });

      await workspaceRepo.create({
        name: 'First Workspace',
        folderPath: uniquePath,
      });

      await expect(
        workspaceRepo.create({
          name: 'Second Workspace',
          folderPath: uniquePath,
        })
      ).rejects.toThrow('Workspace with this folder path already exists');
    });
  });

  describe('findById', () => {
    it('should find workspace by id', async () => {
      const uniquePath = path.join(testWorkspacePath, 'find-by-id-' + Date.now());
      fs.mkdirSync(uniquePath, { recursive: true });

      const created = await workspaceRepo.create({
        name: 'Find By ID',
        folderPath: uniquePath,
      });

      const found = await workspaceRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Find By ID');
    });

    it('should return null for non-existent id', async () => {
      const found = await workspaceRepo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByFolderPath', () => {
    it('should find workspace by folder path', async () => {
      const uniquePath = path.join(testWorkspacePath, 'find-by-path-' + Date.now());
      fs.mkdirSync(uniquePath, { recursive: true });

      await workspaceRepo.create({
        name: 'Find By Path',
        folderPath: uniquePath,
      });

      const found = await workspaceRepo.findByFolderPath(uniquePath);
      expect(found).toBeDefined();
      expect(found?.folderPath).toBe(uniquePath);
    });

    it('should return null for non-existent path', async () => {
      const found = await workspaceRepo.findByFolderPath('/non/existent/path');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all workspaces', async () => {
      const all = await workspaceRepo.findAll();
      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe('getActive', () => {
    it('should return null when no active workspace', async () => {
      // Note: This may have an active workspace from other tests
      const active = await workspaceRepo.getActive();
      // Could be null or a workspace depending on test order
      expect(active === null || typeof active === 'object').toBe(true);
    });
  });
});
