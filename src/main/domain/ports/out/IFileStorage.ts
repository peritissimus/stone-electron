/**
 * File Storage Port (Outbound)
 *
 * Defines the contract for file system operations.
 * Implementations can be local filesystem, S3, etc.
 */

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

export interface IFileStorage {
  /**
   * Read file content as string
   * Returns null if file doesn't exist or is empty
   */
  read(filePath: string): Promise<string | null>;

  /**
   * Write content to a file
   */
  write(filePath: string, content: string): Promise<void>;

  /**
   * Delete a file
   */
  delete(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Rename/move a file
   */
  rename(oldPath: string, newPath: string): Promise<void>;

  /**
   * Create a directory
   */
  createDirectory(dirPath: string): Promise<void>;

  /**
   * Delete a directory (recursively)
   */
  deleteDirectory(dirPath: string): Promise<void>;

  /**
   * List files in a directory
   */
  listFiles(dirPath: string): Promise<FileInfo[]>;

  /**
   * List files matching a pattern (glob)
   */
  glob(pattern: string, basePath: string): Promise<string[]>;

  /**
   * Get file info
   */
  getFileInfo(filePath: string): Promise<FileInfo | null>;

  /**
   * Copy a file
   */
  copy(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Watch for file changes
   */
  watch(
    path: string,
    callback: (event: 'add' | 'change' | 'unlink', filePath: string) => void,
  ): () => void;
}
