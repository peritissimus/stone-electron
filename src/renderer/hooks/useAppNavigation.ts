/**
 * useAppNavigation Hook - Centralized navigation for the app
 *
 * Provides type-safe navigation methods using React Router.
 * Replaces the old state-based navigation (activePage, setActiveNote).
 */

import { useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toHome, toJournals, toTasks, toGraph, toTopics, toNote } from '@renderer/navigation';

export type AppPage = 'home' | 'journals' | 'tasks' | 'graph' | 'topics';

const PAGE_ROUTES: Record<AppPage, string> = {
  home: toHome(),
  journals: toJournals(),
  tasks: toTasks(),
  graph: toGraph(),
  topics: toTopics(),
};

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ noteId: string }>();

  // Navigate to a page
  const goToPage = useCallback(
    (page: AppPage) => {
      navigate(PAGE_ROUTES[page]);
    },
    [navigate],
  );

  // Navigate to a note
  const goToNote = useCallback(
    (noteId: string) => {
      navigate(toNote(noteId));
    },
    [navigate],
  );

  // Navigate to home
  const goHome = useCallback(() => {
    navigate(toHome());
  }, [navigate]);

  // Get current active note ID from URL
  const activeNoteId = params.noteId ?? null;

  // Get current page from URL
  const getCurrentPage = useCallback((): AppPage | null => {
    const path = location.pathname;
    if (path === '/home' || path === '/') return 'home';
    if (path === '/journals') return 'journals';
    if (path === '/tasks') return 'tasks';
    if (path === '/graph') return 'graph';
    if (path === '/topics') return 'topics';
    return null;
  }, [location.pathname]);

  const activePage = getCurrentPage();

  // Check if we're viewing a note
  const isViewingNote = location.pathname.startsWith('/note/');

  // Go back in history
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    // Navigation actions
    goToPage,
    goToNote,
    goHome,
    goBack,
    navigate,

    // Current state
    activeNoteId,
    activePage,
    isViewingNote,
    location,
  };
}
