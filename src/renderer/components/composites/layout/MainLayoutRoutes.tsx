/**
 * MainLayout route tree — lazy-loaded pages behind Suspense skeletons.
 * Split out of MainLayout so the shell stays focused on bootstrap and state.
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { RichTextEditor } from '@renderer/editor';
import type { NoteEditorHandle } from '@renderer/components/features/Editor/NoteEditor';

// Lazy load heavy components
const NoteEditor = lazy(() =>
  import('@renderer/components/features/Editor/NoteEditor').then((m) => ({
    default: m.NoteEditor,
  })),
);
const ScratchEditor = lazy(() =>
  import('@renderer/components/features/Editor/ScratchEditor').then((m) => ({
    default: m.ScratchEditor,
  })),
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
const MeetingsPage = lazy(() =>
  import('@renderer/components/features/Meeting').then((m) => ({
    default: m.MeetingsPage,
  })),
);
const DailyReviewPage = lazy(() =>
  import('@renderer/components/features/DailyReview').then((m) => ({
    default: m.DailyReviewPage,
  })),
);
const SettingsPage = lazy(() => import('@renderer/pages/SettingsPage'));

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

export const PageSkeleton = () => (
  <div className="flex items-center justify-center h-full animate-pulse">
    <div className="text-center space-y-4">
      <div className="h-8 w-32 bg-muted rounded mx-auto" />
      <div className="h-4 w-48 bg-muted rounded mx-auto" />
    </div>
  </div>
);

// Note route wrapper — the route itself owns which note is active (via useParams).
// Children read it with useActiveNoteId(); no store mirror is required.
function NoteRoute({
  editorRef,
  onEditorChange,
}: {
  editorRef: React.RefObject<NoteEditorHandle>;
  onEditorChange: (editor: RichTextEditor | null) => void;
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NoteEditor ref={editorRef} onEditorChange={onEditorChange} />
    </Suspense>
  );
}

export interface MainLayoutRoutesProps {
  editorRef: React.RefObject<NoteEditorHandle>;
  onEditorChange: (editor: RichTextEditor | null) => void;
}

export function MainLayoutRoutes({ editorRef, onEditorChange }: MainLayoutRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route
        path="/journals"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <JournalsPage />
          </Suspense>
        }
      />
      <Route
        path="/tasks"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <TasksPage />
          </Suspense>
        }
      />
      <Route
        path="/graph"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <GraphPage />
          </Suspense>
        }
      />
      <Route
        path="/topics"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <TopicsPage />
          </Suspense>
        }
      />
      <Route
        path="/meetings"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <MeetingsPage />
          </Suspense>
        }
      />
      <Route
        path="/today"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <DailyReviewPage />
          </Suspense>
        }
      />
      <Route
        path="/settings/:section?"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <SettingsPage />
          </Suspense>
        }
      />
      <Route
        path="/note/:noteId"
        element={<NoteRoute editorRef={editorRef} onEditorChange={onEditorChange} />}
      />
      <Route
        path="/scratch"
        element={
          <Suspense fallback={<EditorSkeleton />}>
            <ScratchEditor />
          </Suspense>
        }
      />
      {/* Catch-all redirect to Today */}
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
