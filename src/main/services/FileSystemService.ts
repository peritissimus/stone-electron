/**
 * FileSystemService - Handles file system operations for markdown files
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getMarkdownService } from './MarkdownService';
import { logger } from '../utils/logger';

export interface MarkdownFile {
  path: string;
  relativePath: string;
  title: string;
  content: string;
  metadata?: {
    tags?: string[];
    favorite?: boolean;
    pinned?: boolean;
    created?: string;
    modified?: string;
  };
}

export interface FolderStructure {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: FolderStructure[];
}

export class FileSystemService {
  private markdownService = getMarkdownService();

  /**
   * Read a markdown file with frontmatter
   */
  async readMarkdownFile(filePath: string): Promise<MarkdownFile> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(fileContent);

      return {
        path: filePath,
        relativePath: filePath,
        title: this.markdownService.extractTitle(parsed.content),
        content: parsed.content,
        metadata: parsed.data as MarkdownFile['metadata'],
      };
    } catch (error) {
      logger.error(`Error reading markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write a markdown file with frontmatter
   */
  async writeMarkdownFile(
    filePath: string,
    content: string,
    metadata?: MarkdownFile['metadata'],
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Prepare file content with frontmatter
      const fileContent = matter.stringify(content, metadata || {});

      await fs.writeFile(filePath, fileContent, 'utf-8');
    } catch (error) {
      logger.error(`Error writing markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a markdown file
   */
  async deleteMarkdownFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error(`Error deleting markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Rename/move a markdown file
   */
  async renameMarkdownFile(oldPath: string, newPath: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(newPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.rename(oldPath, newPath);
    } catch (error) {
      logger.error(`Error renaming markdown file ${oldPath} to ${newPath}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      logger.error(`Error getting file stats ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Scan a folder for markdown files
   */
  async scanFolder(folderPath: string, recursive: boolean = true): Promise<MarkdownFile[]> {
    const files: MarkdownFile[] = [];

    logger.info(`[FileSystem] 📂 Scanning folder: ${folderPath} (recursive: ${recursive})`);

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      logger.info(`[FileSystem] 📋 Found ${entries.length} entries in ${folderPath}`);

      let folderCount = 0;
      let markdownCount = 0;
      let skippedCount = 0;

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.relative(folderPath, fullPath);

        // Skip hidden files and folders
        if (entry.name.startsWith('.')) {
          skippedCount++;
          continue;
        }

        if (entry.isDirectory()) {
          folderCount++;
          logger.info(`[FileSystem] 📁 Found subfolder: ${entry.name}`);
          if (recursive) {
            const subFiles = await this.scanFolder(fullPath, recursive);
            files.push(...subFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          markdownCount++;
          logger.info(`[FileSystem] 📝 Found markdown file: ${entry.name}`);
          try {
            const file = await this.readMarkdownFile(fullPath);
            file.relativePath = relativePath;
            files.push(file);
            logger.info(`[FileSystem] ✅ Successfully read: ${entry.name} (title: "${file.title}")`);
          } catch (error) {
            logger.warn(`[FileSystem] ⚠️  Skipping unreadable file ${fullPath}:`, error);
          }
        }
      }

      logger.info(`[FileSystem] 📊 Scan summary for ${folderPath}:`);
      logger.info(`[FileSystem]    - Folders: ${folderCount}`);
      logger.info(`[FileSystem]    - Markdown files: ${markdownCount}`);
      logger.info(`[FileSystem]    - Skipped (hidden): ${skippedCount}`);
      logger.info(`[FileSystem]    - Total markdown files collected: ${files.length}`);
    } catch (error) {
      logger.error(`[FileSystem] ❌ Error scanning folder ${folderPath}:`, error);
      throw error;
    }

    return files;
  }

  /**
   * Get folder structure (for notebook tree)
   */
  async getFolderStructure(
    folderPath: string,
    basePath: string = folderPath,
  ): Promise<FolderStructure[]> {
    const structure: FolderStructure[] = [];

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        // Skip hidden files and folders
        if (entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          const children = await this.getFolderStructure(fullPath, basePath);
          structure.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            type: 'folder',
            children,
          });
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          structure.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            type: 'file',
          });
        }
      }
    } catch (error) {
      logger.error(`Error getting folder structure ${folderPath}:`, error);
      throw error;
    }

    return structure;
  }

  /**
   * Create a new folder
   */
  async createFolder(folderPath: string): Promise<void> {
    try {
      await fs.mkdir(folderPath, { recursive: true });
    } catch (error) {
      logger.error(`Error creating folder ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderPath: string, recursive: boolean = false): Promise<void> {
    try {
      await fs.rm(folderPath, { recursive, force: true });
    } catch (error) {
      logger.error(`Error deleting folder ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Generate a unique filename if file already exists
   */
  async generateUniqueFilename(dirPath: string, baseName: string, extension: string = '.md'): Promise<string> {
    const sanitized = this.markdownService.sanitizeFilename(baseName);
    let filename = `${sanitized}${extension}`;
    let counter = 1;

    while (await this.fileExists(path.join(dirPath, filename))) {
      filename = `${sanitized} ${counter}${extension}`;
      counter++;
    }

    return filename;
  }

  /**
   * Validate folder path
   */
  async validateFolderPath(folderPath: string): Promise<{ valid: boolean; error?: string }> {
    logger.info(`[FileSystem] 🔍 Validating folder path: ${folderPath}`);

    try {
      const stats = await fs.stat(folderPath);

      if (!stats.isDirectory()) {
        logger.warn(`[FileSystem] ❌ Path is not a directory: ${folderPath}`);
        return { valid: false, error: 'Path is not a directory' };
      }

      // Try to read the directory to check permissions
      await fs.readdir(folderPath);

      logger.info(`[FileSystem] ✅ Folder path is valid: ${folderPath}`);
      return { valid: true };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`[FileSystem] ❌ Folder does not exist: ${folderPath}`);
        return { valid: false, error: 'Folder does not exist' };
      } else if (error.code === 'EACCES') {
        logger.warn(`[FileSystem] ❌ Permission denied: ${folderPath}`);
        return { valid: false, error: 'Permission denied' };
      } else {
        logger.error(`[FileSystem] ❌ Validation error for ${folderPath}:`, error.message);
        return { valid: false, error: error.message || 'Unknown error' };
      }
    }
  }
}

// Singleton instance
let instance: FileSystemService | null = null;

/**
 * Get or create file system service instance
 */
export function getFileSystemService(): FileSystemService {
  if (!instance) {
    instance = new FileSystemService();
  }
  return instance;
}
