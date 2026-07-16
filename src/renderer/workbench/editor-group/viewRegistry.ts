import type { ComponentType } from 'react';

type ViewModule = { default: ComponentType<any> };
type ViewLoader = () => Promise<ViewModule>;

export const loadNoteEditor: ViewLoader = () =>
  import('@renderer/features/notes/views/editor/NoteEditor').then((module) => ({
    default: module.NoteEditor,
  }));
export const loadScratchView: ViewLoader = () =>
  import('@renderer/features/scratch/views/ScratchEditor').then((module) => ({
    default: module.ScratchEditor,
  }));
export const loadJournalsView: ViewLoader = () =>
  import('@renderer/features/journals/views/JournalsView');
export const loadTasksView: ViewLoader = () => import('@renderer/features/tasks/views/TasksView');
export const loadGraphView: ViewLoader = () => import('@renderer/features/graph/views/GraphView');
export const loadTopicsView: ViewLoader = () =>
  import('@renderer/features/topics/views/TopicsView');
export const loadMeetingsView: ViewLoader = () =>
  import('@renderer/features/meetings/views/MeetingsView');
export const loadDailyReviewView: ViewLoader = () =>
  import('@renderer/features/daily-review/views/DailyReviewView');
export const loadSettingsView: ViewLoader = () =>
  import('@renderer/features/settings/views/SettingsView');

const loadersByRoute: Record<string, ViewLoader> = {
  '/today': loadDailyReviewView,
  '/journals': loadJournalsView,
  '/tasks': loadTasksView,
  '/graph': loadGraphView,
  '/topics': loadTopicsView,
  '/meetings': loadMeetingsView,
  '/settings': loadSettingsView,
  '/note': loadNoteEditor,
  '/scratch': loadScratchView,
};

export function prefetchWorkbenchView(path: string): void {
  const route = Object.keys(loadersByRoute).find(
    (candidate) =>
      path === candidate || path.startsWith(`${candidate}/`) || path.startsWith(`${candidate}?`),
  );
  if (route) void loadersByRoute[route]();
}
