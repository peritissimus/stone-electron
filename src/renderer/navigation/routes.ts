/**
 * Canonical route builders.
 *
 * Every call site that needs a renderer-level path string should import
 * from here instead of hard-coding `/home`, `/note/${id}`, etc. Keeps a
 * single source of truth for route shape — nested routes, route params,
 * or alternate shells only require changes in one place.
 */

export const toHome = (): string => '/home';
export const toTasks = (): string => '/tasks';
export const toGraph = (): string => '/graph';
export const toTopics = (): string => '/topics';
export const toNote = (noteId: string): string => `/note/${noteId}`;
