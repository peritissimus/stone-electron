/**
 * System Use Cases Port
 *
 * Defines the contract for system-level operations.
 */

// Request/Response types
export interface GetFontsResponse {
  fonts: string[];
}

// Use case interfaces
export interface IGetSystemFontsUseCase {
  execute(): Promise<GetFontsResponse>;
}

/**
 * Aggregated system use cases interface for DI container
 */
export interface ISystemUseCases {
  getFonts(): Promise<string[]>;
  selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null>;
  validatePath(path: string): Promise<boolean>;
  openInFolder(path: string): void;
  openExternal(url: string): Promise<void>;
}
