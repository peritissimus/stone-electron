import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { ISystemAudioTap } from '../../../domain/ports/out/ISystemAudioTap';
import type { ISystemUseCases } from '../../../domain/ports/in/ISystemUseCases';
import { GetSystemFontsUseCase } from './GetSystemFontsUseCase';
import { ShowFolderPickerUseCase } from './ShowFolderPickerUseCase';
import { ValidateSystemPathUseCase } from './ValidateSystemPathUseCase';
import { OpenInFolderUseCase } from './OpenInFolderUseCase';
import { OpenExternalUseCase } from './OpenExternalUseCase';
import { GetMicAccessStatusUseCase, RequestMicAccessUseCase } from './MicAccessUseCases';
import {
  GetSystemAudioAccessUseCase,
  RequestSystemAudioAccessUseCase,
} from './SystemAudioAccessUseCases';

export { GetSystemFontsUseCase } from './GetSystemFontsUseCase';
export { ShowFolderPickerUseCase } from './ShowFolderPickerUseCase';
export { ValidateSystemPathUseCase } from './ValidateSystemPathUseCase';
export { OpenInFolderUseCase } from './OpenInFolderUseCase';
export { OpenExternalUseCase } from './OpenExternalUseCase';
export { GetMicAccessStatusUseCase, RequestMicAccessUseCase } from './MicAccessUseCases';
export {
  GetSystemAudioAccessUseCase,
  RequestSystemAudioAccessUseCase,
} from './SystemAudioAccessUseCases';

export interface SystemUseCasesDeps {
  systemBridge: ISystemBridge;
  /** Native system-audio helper; absent off-macOS. */
  systemAudioTap?: ISystemAudioTap;
}

export function createSystemUseCases(deps: SystemUseCasesDeps): ISystemUseCases {
  const { systemBridge, systemAudioTap } = deps;

  return {
    getFonts: new GetSystemFontsUseCase(systemBridge),
    selectFolder: new ShowFolderPickerUseCase(systemBridge),
    validatePath: new ValidateSystemPathUseCase(systemBridge),
    openInFolder: new OpenInFolderUseCase(systemBridge),
    openExternal: new OpenExternalUseCase(systemBridge),
    getMicAccessStatus: new GetMicAccessStatusUseCase(systemBridge),
    requestMicAccess: new RequestMicAccessUseCase(systemBridge),
    getSystemAudioAccess: new GetSystemAudioAccessUseCase(systemAudioTap),
    requestSystemAudioAccess: new RequestSystemAudioAccessUseCase(systemAudioTap),
  };
}
