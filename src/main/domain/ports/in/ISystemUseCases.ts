/**
 * System Use Cases Port
 *
 * Defines the contract for system-level operations.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { MicrophoneAccessStatus } from '../out/ISystemBridge';

/**
 * Screen & System Audio Recording permission state. 'unsupported' on platforms
 * where the macOS Screen Recording grant doesn't apply (Windows/Linux loopback).
 */
export type SystemAudioPermission = 'granted' | 'denied' | 'unsupported';

export interface IGetSystemFontsUseCase {
  execute(): Effect.Effect<{ fonts: string[] }, Error>;
}

export interface IShowFolderPickerUseCase {
  execute(request?: {
    title?: string;
    defaultPath?: string;
  }): Effect.Effect<{ folderPath: string | null }, Error>;
}

export interface IValidateSystemPathUseCase {
  execute(request: { path: string }): Effect.Effect<{ isValid: boolean }, Error>;
}

export interface IOpenInFolderUseCase {
  execute(request: { path: string }): Effect.Effect<void, Error>;
}

export interface IOpenExternalUseCase {
  execute(request: { url: string }): Effect.Effect<void, Error>;
}

export interface IGetMicAccessStatusUseCase {
  execute(): Effect.Effect<{ status: MicrophoneAccessStatus }, Error>;
}

export interface IRequestMicAccessUseCase {
  execute(): Effect.Effect<{ granted: boolean; status: MicrophoneAccessStatus }, Error>;
}

export interface IGetSystemAudioAccessUseCase {
  execute(): Effect.Effect<{ status: SystemAudioPermission }, Error>;
}

export interface IRequestSystemAudioAccessUseCase {
  execute(): Effect.Effect<{ status: SystemAudioPermission }, Error>;
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
  getMicAccessStatus: IGetMicAccessStatusUseCase;
  requestMicAccess: IRequestMicAccessUseCase;
  getSystemAudioAccess: IGetSystemAudioAccessUseCase;
  requestSystemAudioAccess: IRequestSystemAudioAccessUseCase;
}

export const SystemUseCasesPort =
  Context.GenericTag<ISystemUseCases>('stone/ISystemUseCases');
