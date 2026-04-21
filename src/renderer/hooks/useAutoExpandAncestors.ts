import { useEffect } from 'react';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useTreeSelection } from '@renderer/hooks/useTreeSelection';

/**
 * Whenever the active file changes, ensure all its ancestor folders are
 * marked expanded so the file is visible in the tree. Writes only to
 * expandedPaths — the only legitimate tree UI state — never to selection,
 * which is derived.
 *
 * Mount once at the top of the app tree.
 */
export function useAutoExpandAncestors() {
  const { selectedFile } = useTreeSelection();
  const expandPath = useFileTreeStore((s) => s.expandPath);

  useEffect(() => {
    if (!selectedFile) return;
    expandPath(selectedFile);
  }, [selectedFile, expandPath]);
}
