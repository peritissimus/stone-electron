/**
 * Draft Storage - localStorage-based buffer for crash recovery
 * Stores unsaved editor content to prevent data loss on crashes
 */

import { logger } from '@renderer/utils/logger';

interface Draft {
  noteId: string;
  content: string; // JSON string of TipTap document
  timestamp: number;
  title?: string;
}

const DRAFT_PREFIX = 'stone_draft_';
const DRAFT_INDEX_KEY = 'stone_draft_index';

/**
 * Save draft to localStorage
 */
export function saveDraft(noteId: string, content: string, title?: string): void {
  try {
    const draft: Draft = {
      noteId,
      content,
      timestamp: Date.now(),
      title,
    };

    // Save the draft
    localStorage.setItem(`${DRAFT_PREFIX}${noteId}`, JSON.stringify(draft));

    // Update the index
    const index = getDraftIndex();
    if (!index.includes(noteId)) {
      index.push(noteId);
      localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
    }
  } catch (error) {
    logger.error('Failed to save draft:', error);
  }
}

/**
 * Get draft for a note
 */
export function getDraft(noteId: string): Draft | null {
  try {
    const item = localStorage.getItem(`${DRAFT_PREFIX}${noteId}`);
    if (!item) return null;

    const draft = JSON.parse(item) as Draft;
    return draft;
  } catch (error) {
    logger.error('Failed to get draft:', error);
    return null;
  }
}

/**
 * Delete draft for a note
 */
export function deleteDraft(noteId: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${noteId}`);

    // Update the index
    const index = getDraftIndex();
    const newIndex = index.filter((id) => id !== noteId);
    localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(newIndex));
  } catch (error) {
    logger.error('Failed to delete draft:', error);
  }
}

/**
 * Get all draft note IDs
 */
function getDraftIndex(): string[] {
  try {
    const item = localStorage.getItem(DRAFT_INDEX_KEY);
    if (!item) return [];
    return JSON.parse(item) as string[];
  } catch (error) {
    logger.error('Failed to get draft index:', error);
    return [];
  }
}

/**
 * Get all drafts
 */
export function getAllDrafts(): Draft[] {
  try {
    const index = getDraftIndex();
    const drafts: Draft[] = [];

    for (const noteId of index) {
      const draft = getDraft(noteId);
      if (draft) {
        drafts.push(draft);
      }
    }

    return drafts;
  } catch (error) {
    logger.error('Failed to get all drafts:', error);
    return [];
  }
}

/**
 * Clear all drafts
 */
export function clearAllDrafts(): void {
  try {
    const index = getDraftIndex();
    for (const noteId of index) {
      localStorage.removeItem(`${DRAFT_PREFIX}${noteId}`);
    }
    localStorage.removeItem(DRAFT_INDEX_KEY);
  } catch (error) {
    logger.error('Failed to clear all drafts:', error);
  }
}

/**
 * Check if draft is newer than last save
 */
export function hasDraft(noteId: string): boolean {
  const draft = getDraft(noteId);
  return draft !== null;
}
