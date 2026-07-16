import { useNoteReads } from './useNoteReads';
import { useNoteWrites } from './useNoteWrites';
import { useNoteExportActions } from './useNoteExportActions';

export function useNoteAPI() {
  const reads = useNoteReads();
  const writes = useNoteWrites();
  const exports = useNoteExportActions();

  return {
    ...reads,
    ...writes,
    ...exports,
  };
}
