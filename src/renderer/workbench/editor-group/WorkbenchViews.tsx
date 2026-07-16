/**
 * Workbench view registry — lazy-loaded feature views behind stable fallbacks.
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { RichTextEditor } from '@renderer/features/notes/editor';
import type { NoteEditorHandle } from '@renderer/features/notes/views/editor/NoteEditor';
import {
  loadDailyReviewView,
  loadGraphView,
  loadJournalsView,
  loadMeetingsView,
  loadNoteEditor,
  loadScratchView,
  loadSettingsView,
  loadTasksView,
  loadTopicsView,
} from './viewRegistry';

// Lazy load heavy components
const NoteEditor = lazy(loadNoteEditor);
const ScratchEditor = lazy(loadScratchView);
const JournalsView = lazy(loadJournalsView);
const TasksView = lazy(loadTasksView);
const GraphView = lazy(loadGraphView);
const TopicsView = lazy(loadTopicsView);
const MeetingsView = lazy(loadMeetingsView);
const DailyReviewView = lazy(loadDailyReviewView);
const SettingsView = lazy(loadSettingsView);

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

export interface WorkbenchViewsProps {
  editorRef: React.RefObject<NoteEditorHandle>;
  onEditorChange: (editor: RichTextEditor | null) => void;
}

export function WorkbenchViews({ editorRef, onEditorChange }: WorkbenchViewsProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route
        path="/journals"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <JournalsView />
          </Suspense>
        }
      />
      <Route
        path="/tasks"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <TasksView />
          </Suspense>
        }
      />
      <Route
        path="/graph"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <GraphView />
          </Suspense>
        }
      />
      <Route
        path="/topics"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <TopicsView />
          </Suspense>
        }
      />
      <Route
        path="/meetings"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <MeetingsView />
          </Suspense>
        }
      />
      <Route
        path="/today"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <DailyReviewView />
          </Suspense>
        }
      />
      <Route
        path="/settings/:section?"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <SettingsView />
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
