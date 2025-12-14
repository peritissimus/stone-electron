/**
 * FileSystemService Tests
 *
 * Integration tests for file system operations
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FileSystemService } from '../../src/main/services/FileSystemService';

describe('FileSystemService', () => {
  let service: FileSystemService;
  let testDir: string;

  beforeEach(async () => {
    service = new FileSystemService();

    // Create a unique test directory for each test
    testDir = path.join(process.cwd(), 'tests', 'tmp', `fs-service-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('writeMarkdownFile', () => {
    it('should write a simple markdown file', async () => {
      const filePath = path.join(testDir, 'test.md');
      const content = '# Test\n\nThis is a test.';

      await service.writeMarkdownFile(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should write markdown file with frontmatter', async () => {
      const filePath = path.join(testDir, 'with-fm.md');
      const content = '# Test\n\nContent here.';
      const metadata = {
        tags: ['test', 'demo'],
        favorite: true,
      };

      await service.writeMarkdownFile(filePath, content, metadata);

      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toContain('---');
      expect(written).toContain('tags:');
      expect(written).toContain('favorite: true');
      expect(written).toContain('# Test');
    });

    it('should create directory if it does not exist', async () => {
      const subDir = path.join(testDir, 'subdir', 'nested');
      const filePath = path.join(subDir, 'nested.md');

      await service.writeMarkdownFile(filePath, '# Nested');

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should not write frontmatter for empty metadata', async () => {
      const filePath = path.join(testDir, 'no-fm.md');
      const content = '# No Frontmatter';

      await service.writeMarkdownFile(filePath, content, {});

      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).not.toContain('---');
      expect(written).toBe(content);
    });

    it('should filter out empty tags', async () => {
      const filePath = path.join(testDir, 'filtered-tags.md');
      const content = '# Test';
      const metadata = {
        tags: ['valid', '', 'also-valid', ''],
      };

      await service.writeMarkdownFile(filePath, content, metadata);

      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toContain('tags:');
      expect(written).toContain('valid');
      expect(written).toContain('also-valid');
    });
  });

  describe('readMarkdownFile', () => {
    it('should read a simple markdown file', async () => {
      const filePath = path.join(testDir, 'read-test.md');
      fs.writeFileSync(filePath, '# Hello\n\nWorld');

      const result = await service.readMarkdownFile(filePath, true);

      expect(result.title).toBe('Hello');
      expect(result.content).toContain('World');
      expect(result.path).toBe(filePath);
    });

    it('should read markdown file with frontmatter', async () => {
      const filePath = path.join(testDir, 'read-fm.md');
      const fileContent = `---
tags:
  - test
  - demo
favorite: true
---

# My Title

Content here.`;
      fs.writeFileSync(filePath, fileContent);

      const result = await service.readMarkdownFile(filePath, true);

      expect(result.title).toBe('My Title');
      expect(result.metadata?.tags).toContain('test');
      expect(result.metadata?.tags).toContain('demo');
      expect(result.metadata?.favorite).toBe(true);
    });

    it('should do fast read (title only) when fullContent is false', async () => {
      const filePath = path.join(testDir, 'fast-read.md');
      fs.writeFileSync(filePath, '# Quick Title\n\nLots of content...');

      const result = await service.readMarkdownFile(filePath, false);

      expect(result.title).toBe('Quick Title');
      expect(result.content).toBe(''); // Empty for fast reads
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      await expect(service.readMarkdownFile(filePath)).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(testDir, 'exists.md');
      fs.writeFileSync(filePath, 'test');

      const exists = await service.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = path.join(testDir, 'does-not-exist.md');

      const exists = await service.fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should return true for existing directory', async () => {
      const exists = await service.fileExists(testDir);
      expect(exists).toBe(true);
    });
  });

  describe('deleteMarkdownFile', () => {
    it('should delete an existing file', async () => {
      const filePath = path.join(testDir, 'to-delete.md');
      fs.writeFileSync(filePath, 'delete me');

      await service.deleteMarkdownFile(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      await expect(service.deleteMarkdownFile(filePath)).rejects.toThrow();
    });
  });

  describe('renameMarkdownFile', () => {
    it('should rename a file', async () => {
      const oldPath = path.join(testDir, 'old-name.md');
      const newPath = path.join(testDir, 'new-name.md');
      fs.writeFileSync(oldPath, 'content');

      await service.renameMarkdownFile(oldPath, newPath);

      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(newPath)).toBe(true);
    });

    it('should move file to new directory', async () => {
      const oldPath = path.join(testDir, 'source.md');
      const newPath = path.join(testDir, 'dest', 'moved.md');
      fs.writeFileSync(oldPath, 'content');

      await service.renameMarkdownFile(oldPath, newPath);

      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(newPath)).toBe(true);
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const folderPath = path.join(testDir, 'new-folder');

      await service.createFolder(folderPath);

      expect(fs.existsSync(folderPath)).toBe(true);
      const stats = fs.statSync(folderPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested folders', async () => {
      const folderPath = path.join(testDir, 'a', 'b', 'c');

      await service.createFolder(folderPath);

      expect(fs.existsSync(folderPath)).toBe(true);
    });

    it('should not throw for existing folder', async () => {
      const folderPath = path.join(testDir, 'existing');
      fs.mkdirSync(folderPath);

      await expect(service.createFolder(folderPath)).resolves.not.toThrow();
    });
  });

  describe('deleteFolder', () => {
    it('should delete an empty folder with recursive flag', async () => {
      const folderPath = path.join(testDir, 'to-delete');
      fs.mkdirSync(folderPath);

      // Note: fs.rm requires recursive: true to delete directories, even empty ones
      await service.deleteFolder(folderPath, true);

      expect(fs.existsSync(folderPath)).toBe(false);
    });

    it('should delete folder with contents when recursive', async () => {
      const folderPath = path.join(testDir, 'with-contents');
      fs.mkdirSync(folderPath);
      fs.writeFileSync(path.join(folderPath, 'file.md'), 'content');

      await service.deleteFolder(folderPath, true);

      expect(fs.existsSync(folderPath)).toBe(false);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should return base name if not exists', async () => {
      const filename = await service.generateUniqueFilename(testDir, 'MyNote');

      expect(filename).toBe('MyNote.md');
    });

    it('should append number if file exists', async () => {
      fs.writeFileSync(path.join(testDir, 'MyNote.md'), 'existing');

      const filename = await service.generateUniqueFilename(testDir, 'MyNote');

      expect(filename).toBe('MyNote 1.md');
    });

    it('should increment number for multiple conflicts', async () => {
      fs.writeFileSync(path.join(testDir, 'Note.md'), '1');
      fs.writeFileSync(path.join(testDir, 'Note 1.md'), '2');
      fs.writeFileSync(path.join(testDir, 'Note 2.md'), '3');

      const filename = await service.generateUniqueFilename(testDir, 'Note');

      expect(filename).toBe('Note 3.md');
    });

    it('should use Untitled for empty base name', async () => {
      const filename = await service.generateUniqueFilename(testDir, '');

      expect(filename).toBe('Untitled.md');
    });

    it('should use custom extension', async () => {
      const filename = await service.generateUniqueFilename(testDir, 'MyFile', '.txt');

      expect(filename).toBe('MyFile.txt');
    });
  });

  describe('generateTimestampFilename', () => {
    it('should generate timestamp-based filename', async () => {
      const filename = await service.generateTimestampFilename(testDir);

      // Should match pattern: YYYY-MM-DD-HHMMSS-XXX.md
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-\d{3}\.md$/);
    });

    it('should use custom extension', async () => {
      const filename = await service.generateTimestampFilename(testDir, '.txt');

      expect(filename).toMatch(/\.txt$/);
    });
  });

  describe('generateUniqueFolderName', () => {
    it('should return base name if not exists', async () => {
      const folderName = await service.generateUniqueFolderName(testDir, 'MyFolder');

      expect(folderName).toBe('MyFolder');
    });

    it('should append number if folder exists', async () => {
      fs.mkdirSync(path.join(testDir, 'MyFolder'));

      const folderName = await service.generateUniqueFolderName(testDir, 'MyFolder');

      expect(folderName).toBe('MyFolder 1');
    });

    it('should allow excluded path', async () => {
      fs.mkdirSync(path.join(testDir, 'MyFolder'));
      const excludePath = path.join(testDir, 'MyFolder');

      const folderName = await service.generateUniqueFolderName(testDir, 'MyFolder', excludePath);

      expect(folderName).toBe('MyFolder');
    });

    it('should use Notebook for empty base name', async () => {
      const folderName = await service.generateUniqueFolderName(testDir, '');

      expect(folderName).toBe('Notebook');
    });
  });

  describe('scanFolder', () => {
    it('should find markdown files in folder', async () => {
      fs.writeFileSync(path.join(testDir, 'note1.md'), '# Note 1');
      fs.writeFileSync(path.join(testDir, 'note2.md'), '# Note 2');

      const files = await service.scanFolder(testDir);

      expect(files.length).toBe(2);
      expect(files.map((f) => f.title)).toContain('Note 1');
      expect(files.map((f) => f.title)).toContain('Note 2');
    });

    it('should recursively scan subfolders', async () => {
      fs.writeFileSync(path.join(testDir, 'root.md'), '# Root');
      fs.mkdirSync(path.join(testDir, 'sub'));
      fs.writeFileSync(path.join(testDir, 'sub', 'nested.md'), '# Nested');

      const files = await service.scanFolder(testDir, true);

      expect(files.length).toBe(2);
    });

    it('should not scan subfolders when recursive is false', async () => {
      fs.writeFileSync(path.join(testDir, 'root.md'), '# Root');
      fs.mkdirSync(path.join(testDir, 'sub'));
      fs.writeFileSync(path.join(testDir, 'sub', 'nested.md'), '# Nested');

      const files = await service.scanFolder(testDir, false);

      expect(files.length).toBe(1);
      expect(files[0].title).toBe('Root');
    });

    it('should skip hidden files', async () => {
      fs.writeFileSync(path.join(testDir, 'visible.md'), '# Visible');
      fs.writeFileSync(path.join(testDir, '.hidden.md'), '# Hidden');

      const files = await service.scanFolder(testDir);

      expect(files.length).toBe(1);
      expect(files[0].title).toBe('Visible');
    });

    it('should skip non-markdown files', async () => {
      fs.writeFileSync(path.join(testDir, 'note.md'), '# Note');
      fs.writeFileSync(path.join(testDir, 'readme.txt'), 'text file');
      fs.writeFileSync(path.join(testDir, 'image.png'), 'fake image');

      const files = await service.scanFolder(testDir);

      expect(files.length).toBe(1);
      expect(files[0].title).toBe('Note');
    });

    it('should set relativePath correctly', async () => {
      fs.mkdirSync(path.join(testDir, 'folder'));
      fs.writeFileSync(path.join(testDir, 'folder', 'note.md'), '# Note');

      const files = await service.scanFolder(testDir);

      expect(files[0].relativePath).toBe('folder/note.md');
    });
  });

  describe('getFolderStructure', () => {
    it('should return folder structure', async () => {
      fs.mkdirSync(path.join(testDir, 'folderA'));
      fs.mkdirSync(path.join(testDir, 'folderB'));
      fs.writeFileSync(path.join(testDir, 'file.md'), '# File');
      fs.writeFileSync(path.join(testDir, 'folderA', 'nested.md'), '# Nested');

      const structure = await service.getFolderStructure(testDir);

      expect(structure.length).toBe(3); // folderA, folderB, file.md
      const folders = structure.filter((s) => s.type === 'folder');
      const files = structure.filter((s) => s.type === 'file');
      expect(folders.length).toBe(2);
      expect(files.length).toBe(1);
    });

    it('should include nested structure', async () => {
      fs.mkdirSync(path.join(testDir, 'parent'));
      fs.mkdirSync(path.join(testDir, 'parent', 'child'));
      fs.writeFileSync(path.join(testDir, 'parent', 'child', 'deep.md'), '# Deep');

      const structure = await service.getFolderStructure(testDir);

      const parent = structure.find((s) => s.name === 'parent');
      expect(parent?.children?.length).toBe(1);
      const child = parent?.children?.[0];
      expect(child?.name).toBe('child');
      expect(child?.children?.length).toBe(1);
    });

    it('should skip hidden items', async () => {
      fs.mkdirSync(path.join(testDir, '.hidden'));
      fs.mkdirSync(path.join(testDir, 'visible'));

      const structure = await service.getFolderStructure(testDir);

      expect(structure.length).toBe(1);
      expect(structure[0].name).toBe('visible');
    });
  });

  describe('validateFolderPath', () => {
    it('should return valid for existing directory', async () => {
      const result = await service.validateFolderPath(testDir);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for non-existent path', async () => {
      const result = await service.validateFolderPath('/nonexistent/path/123456');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should return invalid for file path', async () => {
      const filePath = path.join(testDir, 'file.txt');
      fs.writeFileSync(filePath, 'content');

      const result = await service.validateFolderPath(filePath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a directory');
    });
  });

  describe('getFileStats', () => {
    it('should return file stats', async () => {
      const filePath = path.join(testDir, 'stats-test.md');
      fs.writeFileSync(filePath, 'content');

      const stats = await service.getFileStats(filePath);

      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should throw for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      await expect(service.getFileStats(filePath)).rejects.toThrow();
    });
  });

  describe('renameFolder', () => {
    it('should rename a folder', async () => {
      const oldPath = path.join(testDir, 'old-folder');
      const newPath = path.join(testDir, 'new-folder');
      fs.mkdirSync(oldPath);
      fs.writeFileSync(path.join(oldPath, 'file.md'), 'content');

      await service.renameFolder(oldPath, newPath);

      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(newPath)).toBe(true);
      expect(fs.existsSync(path.join(newPath, 'file.md'))).toBe(true);
    });
  });
});
