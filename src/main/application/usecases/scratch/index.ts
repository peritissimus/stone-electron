import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IScratchUseCases } from '../../../domain/ports/in/IScratchUseCases';
import { PickScratchFileUseCase } from './PickScratchFileUseCase';
import { ReadScratchFileUseCase } from './ReadScratchFileUseCase';
import { WriteScratchFileUseCase } from './WriteScratchFileUseCase';

export { PickScratchFileUseCase } from './PickScratchFileUseCase';
export { ReadScratchFileUseCase } from './ReadScratchFileUseCase';
export { WriteScratchFileUseCase } from './WriteScratchFileUseCase';

export interface ScratchUseCasesDeps {
  fileStorage: IFileStorage;
  systemBridge: ISystemBridge;
}

export function createScratchUseCases(deps: ScratchUseCasesDeps): IScratchUseCases {
  return {
    pickScratchFile: new PickScratchFileUseCase(deps.systemBridge),
    readScratchFile: new ReadScratchFileUseCase(deps.fileStorage),
    writeScratchFile: new WriteScratchFileUseCase(deps.fileStorage),
  };
}
