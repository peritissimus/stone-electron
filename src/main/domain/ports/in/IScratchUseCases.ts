/**
 * Scratch editor IN port.
 *
 * Exposed to the renderer via ScratchIPC. Scratch mode operates on raw
 * absolute file paths — no NoteEntity, no workspace, no DB. Use cases
 * here only orchestrate the file-system port + system dialog port.
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

export interface IPickScratchFileUseCase {
  execute(): Effect.Effect<{ path: string | null }, Error>;
}

export interface IReadScratchFileUseCase {
  execute(request: {
    path: string;
  }): Effect.Effect<{ path: string; name: string; content: string }, Error>;
}

export interface IWriteScratchFileUseCase {
  execute(request: {
    path: string;
    content: string;
  }): Effect.Effect<{ path: string }, Error>;
}

export interface IScratchUseCases {
  pickScratchFile: IPickScratchFileUseCase;
  readScratchFile: IReadScratchFileUseCase;
  writeScratchFile: IWriteScratchFileUseCase;
}

export const ScratchUseCasesPort =
  Context.GenericTag<IScratchUseCases>('stone/IScratchUseCases');
