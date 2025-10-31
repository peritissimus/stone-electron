/**
 * FileSystemService - Handles file system operations for markdown files
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getMarkdownService } from './MarkdownService';

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
      console.error(`Error reading markdown file ${filePath}:`, error);
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
      console.error(`Error writing markdown file ${filePath}:`, error);
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
      console.error(`Error deleting markdown file ${filePath}:`, error);
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
      console.error(`Error renaming markdown file ${oldPath} to ${newPath}:`, error);
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
      console.error(`Error getting file stats ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Scan a folder for markdown files
   */
  async scanFolder(folderPath: string, recursive: boolean = true): Promise<MarkdownFile[]> {
    const files: MarkdownFile[] = [];

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.relative(folderPath, fullPath);

        // Skip hidden files and folders
        if (entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          if (recursive) {
            const subFiles = await this.scanFolder(fullPath, recursive);
            files.push(...subFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const file = await this.readMarkdownFile(fullPath);
            file.relativePath = relativePath;
            files.push(file);
          } catch (error) {
            console.warn(`Skipping unreadable file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning folder ${folderPath}:`, error);
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
      console.error(`Error getting folder structure ${folderPath}:`, error);
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
      console.error(`Error creating folder ${folderPath}:`, error);
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
      console.error(`Error deleting folder ${folderPath}:`, error);
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
    try {
      const stats = await fs.stat(folderPath);

      if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
      }

      // Try to read the directory to check permissions
      await fs.readdir(folderPath);

      return { valid: true };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { valid: false, error: 'Folder does not exist' };
      } else if (error.code === 'EACCES') {
        return { valid: false, error: 'Permission denied' };
      } else {
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
