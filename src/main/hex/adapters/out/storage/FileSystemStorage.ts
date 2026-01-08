/**
 * File System Storage Adapter
 *
 * Implements IFileStorage port using Node.js fs module.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import { glob as globModule } from 'glob';
import type { IFileStorage, FileInfo } from '../../../domain/ports/out/IFileStorage';

export class FileSystemStorage implements IFileStorage {
  async read(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  async write(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async delete(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const dir = path.dirname(newPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(oldPath, newPath);
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
  }

  async listFiles(dirPath: string): Promise<FileInfo[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);

      files.push({
        path: fullPath,
        name: entry.name,
        size: stats.size,
        isDirectory: entry.isDirectory(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      });
    }

    return files;
  }

  async glob(pattern: string, basePath: string): Promise<string[]> {
    const matches = await globModule(pattern, {
      cwd: basePath,
      absolute: true,
      nodir: true,
    });
    return matches;
  }

  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        isDirectory: stats.isDirectory(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  async copy(sourcePath: string, destPath: string): Promise<void> {
    const dir = path.dirname(destPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }

  watch(
    watchPath: string,
    callback: (event: 'add' | 'change' | 'unlink', filePath: string) => void
  ): () => void {
    const watcher: FSWatcher = watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    watcher
      .on('add', (filePath) => callback('add', filePath))
      .on('change', (filePath) => callback('change', filePath))
      .on('unlink', (filePath) => callback('unlink', filePath));

    return () => {
      watcher.close();
    };
  }
}
