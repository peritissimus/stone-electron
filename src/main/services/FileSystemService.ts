/**
 * FileSystemService - Handles file system operations for markdown files
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getMarkdownService } from './MarkdownService';
import { logger } from '../utils/logger';

/**
 * Max bytes to read for fast title extraction (enough for frontmatter + first heading)
 */
const FAST_READ_BYTES = 2048;

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
   * Read a markdown file with frontmatter (fast - only reads head for title/metadata)
   */
  async readMarkdownFile(filePath: string, fullContent = false): Promise<MarkdownFile> {
    try {
      if (fullContent) {
        // Full read for actual note opening
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(fileContent);

        return {
          path: filePath,
          relativePath: filePath,
          title: this.markdownService.extractTitle(parsed.content),
          content: parsed.content,
          metadata: parsed.data as MarkdownFile['metadata'],
        };
      }

      // Fast read - only get frontmatter + first heading
      const handle = await fs.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(FAST_READ_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, FAST_READ_BYTES, 0);
        const headContent = buffer.slice(0, bytesRead).toString('utf-8');

        const parsed = matter(headContent);
        const title = this.markdownService.extractTitle(parsed.content);

        return {
          path: filePath,
          relativePath: filePath,
          title,
          content: '', // Empty for fast scans
          metadata: parsed.data as MarkdownFile['metadata'],
        };
      } finally {
        await handle.close();
      }
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

      // Prepare metadata without undefined values
      const normalizedMetadata: Record<string, unknown> = {};
      if (metadata) {
        const sanitizedTags = Array.isArray(metadata.tags)
          ? metadata.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
          : undefined;
        if (sanitizedTags && sanitizedTags.length > 0) {
          normalizedMetadata.tags = sanitizedTags;
        }
        if (metadata.favorite !== undefined) {
          normalizedMetadata.favorite = metadata.favorite;
        }
        if (metadata.pinned !== undefined) {
          normalizedMetadata.pinned = metadata.pinned;
        }
        if (metadata.created) {
          normalizedMetadata.created = metadata.created;
        }
        if (metadata.modified) {
          normalizedMetadata.modified = metadata.modified;
        }
      }

      const hasMetadata = Object.keys(normalizedMetadata).length > 0;
      const fileContent = hasMetadata ? matter.stringify(content, normalizedMetadata) : content;

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
  async scanFolder(
    folderPath: string,
    recursive: boolean = true,
    basePath: string = folderPath,
    isRoot: boolean = true,
  ): Promise<MarkdownFile[]> {
    const files: MarkdownFile[] = [];

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const subfolderPaths: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path
          .relative(basePath, fullPath)
          .split(path.sep)
          .filter(Boolean)
          .join('/');

        // Skip hidden files and folders
        if (entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          if (recursive) {
            subfolderPaths.push(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const file = await this.readMarkdownFile(fullPath, false);
            file.relativePath = relativePath;
            files.push(file);
          } catch (error) {
            logger.warn(`[FileSystem] Skipping unreadable file: ${entry.name}`);
          }
        }
      }

      // Scan all subfolders in parallel
      if (subfolderPaths.length > 0 && recursive) {
        const subResults = await Promise.all(
          subfolderPaths.map(subPath => this.scanFolder(subPath, recursive, basePath, false))
        );
        subResults.forEach(subFiles => files.push(...subFiles));
      }

      // Only log summary at root level
      if (isRoot) {
        logger.info(`[FileSystem] Scanned ${path.basename(folderPath)}: ${files.length} notes`);
      }
    } catch (error) {
      logger.error(`[FileSystem] Error scanning ${folderPath}:`, error);
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
  async generateUniqueFilename(
    dirPath: string,
    baseName: string,
    extension: string = '.md',
  ): Promise<string> {
    const sanitizedBase = this.markdownService.sanitizeFilename(baseName || 'Untitled');
    const base = sanitizedBase && sanitizedBase.trim().length > 0 ? sanitizedBase : 'Untitled';
    let filename = `${base}${extension}`;
    let counter = 1;

    while (await this.fileExists(path.join(dirPath, filename))) {
      filename = `${base} ${counter}${extension}`;
      counter++;
    }

    return filename;
  }

  /**
   * Generate a timestamp-based unique filename (title-independent)
   * Format: YYYY-MM-DD-HHMMSS-RANDOM.md
   * This ensures filenames are unique and immutable, separate from note titles
   */
  async generateTimestampFilename(
    dirPath: string,
    extension: string = '.md',
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Add a random suffix to handle multiple notes created in the same second
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    let filename = `${year}-${month}-${day}-${hours}${minutes}${seconds}-${random}${extension}`;
    let counter = 1;

    // Ensure uniqueness (very unlikely to need this, but just in case)
    while (await this.fileExists(path.join(dirPath, filename))) {
      filename = `${year}-${month}-${day}-${hours}${minutes}${seconds}-${random}-${counter}${extension}`;
      counter++;
    }

    return filename;
  }

  /**
   * Generate a unique folder name within a directory
   */
  async generateUniqueFolderName(
    dirPath: string,
    baseName: string,
    excludePath?: string,
  ): Promise<string> {
    const sanitizedBase = this.markdownService.sanitizeFilename(baseName || 'Notebook');
    const base = sanitizedBase && sanitizedBase.trim().length > 0 ? sanitizedBase : 'Notebook';
    let folderName = base;
    let counter = 1;

    const normalizedExclude = excludePath ? path.resolve(excludePath) : null;

    // Loop until we find a folder name that doesn't exist (unless it's the excluded path)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidatePath = path.join(dirPath, folderName);
      const exists = await this.fileExists(candidatePath);

      if (!exists) {
        return folderName;
      }

      if (normalizedExclude && path.resolve(candidatePath) === normalizedExclude) {
        return folderName;
      }

      folderName = `${base} ${counter}`;
      counter++;
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.rename(oldPath, newPath);
    } catch (error) {
      logger.error(`Error renaming folder ${oldPath} to ${newPath}:`, error);
      throw error;
    }
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
        logger.error(`[FileSystem] Validation error:`, error.message);
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
