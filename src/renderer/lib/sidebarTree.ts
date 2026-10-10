/** Stable DOM identity shared by tree rows and the focused tree container. */
export function getSidebarTreeItemId(path: string): string {
  return `sidebar-tree-item-${encodeURIComponent(path)}`;
}
