/**
 * Route definitions for the app
 */

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

// Lazy load page components
const HomePage = lazy(() =>
  import('@renderer/components/features/HomePage/HomePage').then((m) => ({ default: m.HomePage })),
);
const JournalsPage = lazy(() => import('@renderer/pages/JournalsPage'));
const TasksPage = lazy(() =>
  import('@renderer/components/features/Tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const GraphPage = lazy(() =>
  import('@renderer/components/features/Graph/GraphPage').then((m) => ({ default: m.GraphPage })),
);
const TopicsPage = lazy(() =>
  import('@renderer/components/features/Topics/TopicsPage').then((m) => ({
    default: m.TopicsPage,
  })),
);
const NoteEditor = lazy(() =>
  import('@renderer/components/features/Editor/NoteEditor').then((m) => ({
    default: m.NoteEditor,
  })),
);

// Loading skeletons
const EditorSkeleton = () => (
  <div className="flex flex-col h-full animate-pulse">
    <div className="h-12 border-b border-border flex items-center px-4">
      <div className="h-6 w-48 bg-muted rounded" />
    </div>
    <div className="flex-1 p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
      </div>
    </div>
  </div>
);

const PageSkeleton = () => (
  <div className="flex items-center justify-center h-full animate-pulse">
    <div className="text-center space-y-4">
      <div className="h-8 w-32 bg-muted rounded mx-auto" />
      <div className="h-4 w-48 bg-muted rounded mx-auto" />
    </div>
  </div>
);

// Route configuration
export const routes = [
  {
    path: '/',
    element: <Navigate to="/journals" replace />,
  },
  {
    path: '/home',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/journals',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <JournalsPage />
      </Suspense>
    ),
  },
  {
    path: '/tasks',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <TasksPage />
      </Suspense>
    ),
  },
  {
    path: '/graph',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <GraphPage />
      </Suspense>
    ),
  },
  {
    path: '/topics',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <TopicsPage />
      </Suspense>
    ),
  },
  {
    path: '/note/:noteId',
    element: (
      <Suspense fallback={<EditorSkeleton />}>
        <NoteEditor />
      </Suspense>
    ),
  },
];

// Export skeletons for use elsewhere
export { EditorSkeleton, PageSkeleton };
