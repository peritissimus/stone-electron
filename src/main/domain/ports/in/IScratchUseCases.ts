/**
 * Scratch editor IN port.
 *
 * Exposed to the renderer via ScratchIPC. Scratch mode operates on raw
 * absolute file paths — no NoteEntity, no workspace, no DB. Use cases
 * here only orchestrate the file-system port + system dialog port.
 */

export interface IPickScratchFileUseCase {
  execute(): Promise<{ path: string | null }>;
}

export interface IReadScratchFileUseCase {
  execute(request: { path: string }): Promise<{ path: string; name: string; content: string }>;
}

export interface IWriteScratchFileUseCase {
  execute(request: { path: string; content: string }): Promise<{ path: string }>;
}

export interface IScratchUseCases {
  pickScratchFile: IPickScratchFileUseCase;
  readScratchFile: IReadScratchFileUseCase;
  writeScratchFile: IWriteScratchFileUseCase;
}
