import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  NoteUseCasesPort,
  QuickNoteUseCasesPort,
  type IQuickNoteUseCases,
  type QuickNoteSlot,
  type QuickNoteSlotFolders,
} from '../../../domain';

function slotFolder(
  folders: QuickNoteSlotFolders,
  slot: QuickNoteSlot,
): string {
  switch (slot) {
    case 'personal':
      return folders.personal;
    case 'work':
      return folders.work;
    default:
      throw new Error(`Unknown quick-note slot: ${String(slot)}`);
  }
}

export const QuickNoteUseCasesLive = Layer.effect(
  QuickNoteUseCasesPort,
  Effect.gen(function* () {
    const configs = yield* AppConfigRepositoryPort;
    const notes = yield* NoteUseCasesPort;
    const service: IQuickNoteUseCases = {
      createInSlot: (request) =>
        Effect.gen(function* () {
          const config = yield* configs.get();
          const folderPath = yield* Effect.try({
            try: () =>
              slotFolder(
                config.notes.locationPolicy.quickNoteSlotFolders,
                request.slot,
              ),
            catch: (error) =>
              error instanceof Error ? error : new Error(String(error)),
          });
          const millis = yield* Effect.clockWith(
            (clock) => clock.currentTimeMillis,
          );
          const now = new Date(millis);
          const result = yield* notes.createNote.execute({
            title:
              request.title ??
              `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
            content: '',
            folderPath,
            workspaceId: request.workspaceId,
          });
          return { noteId: result.note.id };
        }),
    };
    return service;
  }),
);
