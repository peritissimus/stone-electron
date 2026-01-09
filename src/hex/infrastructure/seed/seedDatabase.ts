/**
 * Database Seed Function
 *
 * Seeds the database with default workspace, notebooks, notes, and tags.
 * This mirrors the legacy DatabaseManager.seedDatabase() function.
 */

import { nanoid } from 'nanoid';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { Database } from '../../shared/database';
import { workspaces, notebooks, notes, tags, noteTags } from '../../shared/database/schema';
import { sql } from 'drizzle-orm';

export interface SeedOptions {
  /** Custom workspace folder path. Defaults to ~/NoteBook */
  workspacePath?: string;
  /** Whether to create the actual markdown files on disk */
  createFiles?: boolean;
}

export interface SeedResult {
  workspaceId: string;
  workspacePath: string;
  notebooks: { id: string; name: string; folderPath: string }[];
  notes: { id: string; title: string; filePath: string }[];
  tags: { id: string; name: string }[];
}

/**
 * Check if database already has data
 */
async function isDatabaseSeeded(db: Database): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notebooks);
  return (result[0]?.count ?? 0) > 0;
}

/**
 * Seed the database with default data
 */
export async function seedDatabase(
  db: Database,
  options: SeedOptions = {}
): Promise<SeedResult | null> {
  // Check if already seeded
  if (await isDatabaseSeeded(db)) {
    return null;
  }

  const workspaceFolderPath = options.workspacePath ?? path.join(os.homedir(), 'NoteBook');
  const createFiles = options.createFiles ?? true;

  // Generate IDs
  const workspaceId = nanoid();
  const personalNotebookId = nanoid();
  const workNotebookId = nanoid();
  const welcomeNoteId = nanoid();
  const roadmapNoteId = nanoid();
  const ideasTagId = nanoid();
  const planningTagId = nanoid();
  const now = () => new Date();

  // Create workspace folders on disk
  if (createFiles) {
    try {
      if (!fs.existsSync(workspaceFolderPath)) {
        fs.mkdirSync(workspaceFolderPath, { recursive: true });
      }
      const personalPath = path.join(workspaceFolderPath, 'Personal');
      const workPath = path.join(workspaceFolderPath, 'Work');
      if (!fs.existsSync(personalPath)) fs.mkdirSync(personalPath, { recursive: true });
      if (!fs.existsSync(workPath)) fs.mkdirSync(workPath, { recursive: true });
    } catch (error) {
      console.warn('Could not create workspace directories:', error);
    }
  }

  // Workspace data
  const workspaceData = {
    id: workspaceId,
    name: 'My Notes',
    folderPath: workspaceFolderPath,
    isActive: true,
    createdAt: now(),
    lastAccessedAt: now(),
  };

  // Notebooks data
  const notebooksData = [
    {
      id: personalNotebookId,
      name: 'Personal',
      parentId: null as string | null,
      workspaceId: workspaceId,
      folderPath: 'Personal',
      icon: '📝',
      color: '#ec4899',
      position: 0,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: workNotebookId,
      name: 'Work',
      parentId: null as string | null,
      workspaceId: workspaceId,
      folderPath: 'Work',
      icon: '💼',
      color: '#3b82f6',
      position: 1,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  // Notes data
  const notesData = [
    {
      id: welcomeNoteId,
      title: 'Welcome to Stone',
      content: null as string | null,
      notebookId: personalNotebookId,
      workspaceId: workspaceId,
      filePath: 'Personal/Welcome to Stone.md',
      isFavorite: true,
      isPinned: true,
      isArchived: false,
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: roadmapNoteId,
      title: 'Product Roadmap',
      content: null as string | null,
      notebookId: workNotebookId,
      workspaceId: workspaceId,
      filePath: 'Work/Product Roadmap.md',
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  // Tags data
  const tagsData = [
    { id: ideasTagId, name: 'ideas', color: '#22c55e', createdAt: now(), updatedAt: now() },
    { id: planningTagId, name: 'planning', color: '#f97316', createdAt: now(), updatedAt: now() },
  ];

  // Note-tag relationships
  const noteTagsData = [
    { noteId: welcomeNoteId, tagId: ideasTagId, createdAt: now() },
    { noteId: roadmapNoteId, tagId: planningTagId, createdAt: now() },
  ];

  // Insert into database
  await db.insert(workspaces).values(workspaceData);
  await db.insert(notebooks).values(notebooksData);
  await db.insert(notes).values(notesData);
  await db.insert(tags).values(tagsData);
  await db.insert(noteTags).values(noteTagsData);

  // Create markdown files on disk
  if (createFiles) {
    try {
      const welcomeFilePath = path.join(workspaceFolderPath, 'Personal', 'Welcome to Stone.md');
      const roadmapFilePath = path.join(workspaceFolderPath, 'Work', 'Product Roadmap.md');

      if (!fs.existsSync(welcomeFilePath)) {
        const welcomeMarkdown = `---
tags:
  - ideas
favorite: true
pinned: true
---

# Welcome to Stone

This sample note shows how rich text content is stored.

- Create notebooks to organize topics.
- Add tags to group related ideas.
- Use the TipTap editor to capture your thoughts.
`;
        fs.writeFileSync(welcomeFilePath, welcomeMarkdown, 'utf-8');
      }

      if (!fs.existsSync(roadmapFilePath)) {
        const roadmapMarkdown = `---
tags:
  - planning
---

# Quarterly Roadmap

Track the high-level initiatives planned for this quarter.

1. Ship the new editor experience.
2. Improve sync reliability.
3. Publish public beta announcement.
`;
        fs.writeFileSync(roadmapFilePath, roadmapMarkdown, 'utf-8');
      }
    } catch (error) {
      console.warn('Could not create seed markdown files:', error);
    }
  }

  return {
    workspaceId,
    workspacePath: workspaceFolderPath,
    notebooks: notebooksData.map(n => ({ id: n.id, name: n.name, folderPath: n.folderPath })),
    notes: notesData.map(n => ({ id: n.id, title: n.title, filePath: n.filePath })),
    tags: tagsData.map(t => ({ id: t.id, name: t.name })),
  };
}

/**
 * Force seed the database (clears existing data first)
 */
export async function forceSeedDatabase(
  db: Database,
  options: SeedOptions = {}
): Promise<SeedResult> {
  // Clear existing data in reverse order of dependencies
  await db.delete(noteTags);
  await db.delete(tags);
  await db.delete(notes);
  await db.delete(notebooks);
  await db.delete(workspaces);

  const result = await seedDatabase(db, options);
  if (!result) {
    throw new Error('Failed to seed database');
  }
  return result;
}
