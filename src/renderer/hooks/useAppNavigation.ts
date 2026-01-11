/**
 * useAppNavigation Hook - Centralized navigation for the app
 *
 * Provides type-safe navigation methods using React Router.
 * Replaces the old state-based navigation (activePage, setActiveNote).
 */

import { useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

export type AppPage = 'home' | 'tasks' | 'graph' | 'topics';

const PAGE_ROUTES: Record<AppPage, string> = {
  home: '/home',
  tasks: '/tasks',
  graph: '/graph',
  topics: '/topics',
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
      navigate(`/note/${noteId}`);
    },
    [navigate],
  );

  // Navigate to home
  const goHome = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  // Get current active note ID from URL
  const activeNoteId = params.noteId ?? null;

  // Get current page from URL
  const getCurrentPage = useCallback((): AppPage | null => {
    const path = location.pathname;
    if (path === '/home' || path === '/') return 'home';
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
