/**
 * Quick Note Use Cases Port
 *
 * "Quick note" slots are named targets a user can create notes into via a
 * keyboard shortcut or command — e.g. personal, work. The renderer hands
 * over a slot id; the implementation owns the folder mapping and seed
 * content, keeping folder names out of the renderer.
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

export type QuickNoteSlot = 'personal' | 'work';

export interface CreateQuickNoteRequest {
  slot: QuickNoteSlot;
  /** Optional title override; defaults to an Untitled + timestamp string. */
  title?: string;
  /** Optional workspace override; defaults to the active workspace. */
  workspaceId?: string;
}

export interface CreateQuickNoteResponse {
  noteId: string;
}

export interface IQuickNoteUseCases {
  createInSlot(
    request: CreateQuickNoteRequest,
  ): Effect.Effect<CreateQuickNoteResponse, Error>;
}

export const QuickNoteUseCasesPort =
  Context.GenericTag<IQuickNoteUseCases>('stone/IQuickNoteUseCases');
