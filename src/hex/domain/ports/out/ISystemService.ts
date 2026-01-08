/**
 * System Service Port - Outbound interface for system operations
 */

/**
 * File picker options
 */
export interface FilePickerOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  multiSelect?: boolean;
}

/**
 * Folder picker options
 */
export interface FolderPickerOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
}

/**
 * System Service - Handles OS-level operations
 */
export interface ISystemService {
  /**
   * Get available system fonts
   */
  getFonts(): Promise<string[]>;

  /**
   * Show folder selection dialog
   */
  selectFolder(options?: FolderPickerOptions): Promise<string | null>;

  /**
   * Show file selection dialog
   */
  selectFile(options?: FilePickerOptions): Promise<string | string[] | null>;

  /**
   * Show save file dialog
   */
  selectSaveLocation(options?: FilePickerOptions): Promise<string | null>;

  /**
   * Validate a file path exists and is accessible
   */
  validatePath(path: string): Promise<boolean>;

  /**
   * Open a path in the system file explorer
   */
  showInFolder(path: string): void;

  /**
   * Open a URL in the default browser
   */
  openExternal(url: string): Promise<void>;
}
