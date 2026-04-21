/**
 * Database Seed Function
 *
 * Seeds the database with default workspace, notebooks, notes, and tags.
 * This mirrors the legacy DatabaseManager.seedDatabase() function.
 */

import { nanoid } from 'nanoid';
import path from 'node:path';
import fs from 'node:fs';
import type { Database } from '../../shared/database';
import { DEFAULT_APP_CONFIG } from '@shared/types/settings';
import { workspaces, notebooks, notes, tags, noteTags } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';

export interface SeedOptions {
  /** Custom workspace folder path. Defaults to app config defaultWorkspacePath */
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
 * Check if database already has data (workspaces OR notebooks)
 */
async function isDatabaseSeeded(db: Database): Promise<boolean> {
  const workspaceResult = await db.select({ count: sql<number>`COUNT(*)` }).from(workspaces);
  const notebookResult = await db.select({ count: sql<number>`COUNT(*)` }).from(notebooks);
  return (workspaceResult[0]?.count ?? 0) > 0 || (notebookResult[0]?.count ?? 0) > 0;
}

// Per-DB single-flight guard. Prevents concurrent callers from racing past the
// isDatabaseSeeded check and double-inserting (and double-writing seed files).
// Keyed by db reference so distinct DBs (e.g. tests) seed independently.
const inFlightSeeds = new WeakMap<object, Promise<SeedResult | null>>();

/**
 * Seed the database with default data
 */
export async function seedDatabase(
  db: Database,
  options: SeedOptions = {},
): Promise<SeedResult | null> {
  const existing = inFlightSeeds.get(db as unknown as object);
  if (existing) {
    return existing;
  }

  const promise = runSeed(db, options).finally(() => {
    inFlightSeeds.delete(db as unknown as object);
  });
  inFlightSeeds.set(db as unknown as object, promise);
  return promise;
}

async function runSeed(db: Database, options: SeedOptions = {}): Promise<SeedResult | null> {
  // Check if already seeded
  if (await isDatabaseSeeded(db)) {
    return null;
  }

  const workspaceFolderPath =
    options.workspacePath ?? path.join(process.env.HOME ?? process.cwd(), DEFAULT_APP_CONFIG.workspace.defaultWorkspacePath);
  const createFiles = options.createFiles ?? true;

  // Generate IDs
  const existingWorkspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.folderPath, workspaceFolderPath),
  });
  const workspaceId = existingWorkspace?.id ?? nanoid();
  const personalNotebookId = nanoid();
  const workNotebookId = nanoid();
  const journalNotebookId = nanoid();
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
      const journalPath = path.join(workspaceFolderPath, 'Journal');
      if (!fs.existsSync(personalPath)) fs.mkdirSync(personalPath, { recursive: true });
      if (!fs.existsSync(workPath)) fs.mkdirSync(workPath, { recursive: true });
      if (!fs.existsSync(journalPath)) fs.mkdirSync(journalPath, { recursive: true });
    } catch {
      // Ignore filesystem seeding failures here; database seeding can still proceed.
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
    {
      id: journalNotebookId,
      name: 'Journal',
      parentId: null as string | null,
      workspaceId: workspaceId,
      folderPath: 'Journal',
      icon: '📅',
      color: '#22c55e',
      position: 2,
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
  if (!existingWorkspace) {
    try {
      await db
        .insert(workspaces)
        .values(workspaceData)
        .onConflictDoNothing({ target: workspaces.folderPath });
    } catch {
      // Workspace might already exist due to race condition; continue with seeding.
    }
  }
  await db.insert(notebooks).values(notebooksData).onConflictDoNothing();
  await db.insert(notes).values(notesData).onConflictDoNothing();
  await db.insert(tags).values(tagsData).onConflictDoNothing();
  await db.insert(noteTags).values(noteTagsData).onConflictDoNothing();

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
    } catch {
      // Ignore markdown seed file failures here; database seed data is still usable.
    }
  }

  return {
    workspaceId,
    workspacePath: workspaceFolderPath,
    notebooks: notebooksData.map((n) => ({ id: n.id, name: n.name, folderPath: n.folderPath })),
    notes: notesData.map((n) => ({ id: n.id, title: n.title, filePath: n.filePath })),
    tags: tagsData.map((t) => ({ id: t.id, name: t.name })),
  };
}

/**
 * Force seed the database (clears existing data first)
 */
export async function forceSeedDatabase(
  db: Database,
  options: SeedOptions = {},
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
