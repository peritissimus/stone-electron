/**
 * System Use Cases Port
 *
 * Defines the contract for system-level operations.
 */

export interface IGetSystemFontsUseCase {
  execute(): Promise<{ fonts: string[] }>;
}

export interface IShowFolderPickerUseCase {
  execute(request?: { title?: string; defaultPath?: string }): Promise<{ folderPath: string | null }>;
}

export interface IValidateSystemPathUseCase {
  execute(request: { path: string }): Promise<{ isValid: boolean }>;
}

export interface IOpenInFolderUseCase {
  execute(request: { path: string }): Promise<void>;
}

export interface IOpenExternalUseCase {
  execute(request: { url: string }): Promise<void>;
}

/**
 * Aggregated system use cases interface for DI container
 */
export interface ISystemUseCases {
  getFonts: IGetSystemFontsUseCase;
  selectFolder: IShowFolderPickerUseCase;
  validatePath: IValidateSystemPathUseCase;
  openInFolder: IOpenInFolderUseCase;
  openExternal: IOpenExternalUseCase;
}
