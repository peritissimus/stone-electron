import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { ISystemUseCases } from '../../../domain/ports/in/ISystemUseCases';
import { GetSystemFontsUseCase } from './GetSystemFontsUseCase';
import { ShowFolderPickerUseCase } from './ShowFolderPickerUseCase';
import { ValidateSystemPathUseCase } from './ValidateSystemPathUseCase';
import { OpenInFolderUseCase } from './OpenInFolderUseCase';
import { OpenExternalUseCase } from './OpenExternalUseCase';
import { GetMicAccessStatusUseCase } from './GetMicAccessStatusUseCase';
import { RequestMicAccessUseCase } from './RequestMicAccessUseCase';
import { GetSystemAudioAccessUseCase } from './GetSystemAudioAccessUseCase';
import { RequestSystemAudioAccessUseCase } from './RequestSystemAudioAccessUseCase';

export { GetSystemFontsUseCase } from './GetSystemFontsUseCase';
export { ShowFolderPickerUseCase } from './ShowFolderPickerUseCase';
export { ValidateSystemPathUseCase } from './ValidateSystemPathUseCase';
export { OpenInFolderUseCase } from './OpenInFolderUseCase';
export { OpenExternalUseCase } from './OpenExternalUseCase';
export { GetMicAccessStatusUseCase } from './GetMicAccessStatusUseCase';
export { RequestMicAccessUseCase } from './RequestMicAccessUseCase';
export { GetSystemAudioAccessUseCase } from './GetSystemAudioAccessUseCase';
export { RequestSystemAudioAccessUseCase } from './RequestSystemAudioAccessUseCase';

export interface SystemUseCasesDeps {
  systemBridge: ISystemBridge;
}

export function createSystemUseCases(deps: SystemUseCasesDeps): ISystemUseCases {
  const { systemBridge } = deps;

  return {
    getFonts: new GetSystemFontsUseCase(systemBridge),
    selectFolder: new ShowFolderPickerUseCase(systemBridge),
    validatePath: new ValidateSystemPathUseCase(systemBridge),
    openInFolder: new OpenInFolderUseCase(systemBridge),
    openExternal: new OpenExternalUseCase(systemBridge),
    getMicAccessStatus: new GetMicAccessStatusUseCase(systemBridge),
    requestMicAccess: new RequestMicAccessUseCase(systemBridge),
    getSystemAudioAccess: new GetSystemAudioAccessUseCase(systemBridge),
    requestSystemAudioAccess: new RequestSystemAudioAccessUseCase(systemBridge),
  };
}
