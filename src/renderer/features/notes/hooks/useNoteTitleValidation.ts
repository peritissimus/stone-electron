import { useCallback } from 'react';
import { NOTE_TITLE_MAX_LENGTH, NoteTitleRequestSchema } from '@shared/schemas/notes';

/** Keep title editing aligned with the IPC write contract. */
export function useNoteTitleValidation() {
  return useCallback((title: string): string | null => {
    if (NoteTitleRequestSchema.safeParse(title).success) return null;
    return title.trim()
      ? `Note title cannot exceed ${NOTE_TITLE_MAX_LENGTH} characters.`
      : 'Note title cannot be empty.';
  }, []);
}
