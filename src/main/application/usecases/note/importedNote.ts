import { NoteEntity, type CreateNoteProps } from '../../../domain';

/** Reconstitute a note already stored in markdown without rewriting its title. */
export function createImportedNote(props: CreateNoteProps, now: Date): NoteEntity {
  return NoteEntity.fromPersistence({
    id: props.id,
    title: props.title ?? 'Untitled',
    filePath: props.filePath ?? null,
    notebookId: props.notebookId ?? null,
    workspaceId: props.workspaceId ?? null,
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
