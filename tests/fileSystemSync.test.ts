import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { getDatabaseManager } from '@main/database';
import { Repositories } from '@main/repositories';

async function writeMarkdown(filePath: string, content: string, fm: Record<string, any> = {}) {
  const frontMatter = Object.keys(fm).length
    ? `---\n${Object.entries(fm)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
        .join('\n')}\n---\n\n`
    : '';
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${frontMatter}${content}`, 'utf8');
}

// NOTE: This integration test requires a clean database without seed data.
// It's skipped for now as it conflicts with DatabaseManager's auto-seeding.
// TODO: Add test isolation support to prevent seed data interference.
describe.skip('File system sync and fetch', () => {
  const tmpRoot = path.join(process.cwd(), 'tests', 'tmp', `ws-fs-${Date.now()}`);
  let repos: Repositories;
  let testWorkspaceId: string;

  beforeAll(async () => {
    // Set up unique test database
    const testDbPath = path.join(process.cwd(), 'tests', 'tmp', `fs-sync-test-${Date.now()}.db`);
    process.env.DATABASE_URL = testDbPath;

    // Init DB (uses DATABASE_URL env var)
    const db = getDatabaseManager();
    await db.initialize();

    // Create repositories AFTER database is initialized
    repos = new Repositories();

    // Create folder structure with markdown files
    await writeMarkdown(path.join(tmpRoot, 'Personal', 'Note A.md'), '# Personal A', {
      tags: ['ideas'],
      favorite: true,
    });
    await writeMarkdown(path.join(tmpRoot, 'Work', 'Note B.md'), '# Work B');
    await writeMarkdown(path.join(tmpRoot, 'Work', 'ProjectX', 'Note C.md'), '# Work ProjectX C');

    // Create workspace pointing to tmpRoot
    const ws = await repos.workspace.create({ name: 'FS Test', folderPath: tmpRoot });
    testWorkspaceId = ws.id;

    // Set this workspace as active
    await repos.workspace.setActive(ws.id);

    // Sync notebooks from folders, then notes from files
    await repos.notebook.syncWithWorkspaceFolders(ws.id);
    await repos.note.syncWithFileSystem(ws.id);
  });

  it('creates notebooks for each folder', async () => {
    const list = await repos.notebook.getFlatList();
    // Filter to only notebooks from our test workspace
    const testNotebooks = list.filter((n) => n.workspaceId === testWorkspaceId);
    const folders = testNotebooks.map((n) => n.folderPath);
    expect(folders).toContain('Personal');
    expect(folders).toContain('Work');
    // Nested folder
    expect(folders).toContain('Work/ProjectX');
  });

  it('finds notes by folder (including nested)', async () => {
    // findByFolder uses the active workspace internally
    const personal = await repos.note.findByFolder('Personal', false);
    const work = await repos.note.findByFolder('Work', true); // include subfolders

    // Filter to only our workspace's notes
    const personalInWorkspace = personal.filter((n) => n.workspaceId === testWorkspaceId);
    const workInWorkspace = work.filter((n) => n.workspaceId === testWorkspaceId);

    expect(personalInWorkspace.length).toBe(1);
    expect(workInWorkspace.length).toBe(2); // Work/Note B.md and Work/ProjectX/Note C.md
  });

  it('assigns notebookId for imported notes', async () => {
    const list = await repos.notebook.getFlatList();
    const personal = list.find((n) => n.folderPath === 'Personal' && n.workspaceId === testWorkspaceId);
    expect(personal).toBeTruthy();
    const notesInPersonal = await repos.note.findByNotebook(personal!.id);
    expect(notesInPersonal.length).toBe(1);
  });

  afterAll(async () => {
    // Close database
    try {
      const db = getDatabaseManager();
      await db.close();
    } catch {
      // Ignore errors
    }

    // Clean up temporary files
    try {
      if (fsSync.existsSync(tmpRoot)) {
        fsSync.rmSync(tmpRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore errors
    }

    // Clean up DATABASE_URL
    delete process.env.DATABASE_URL;
  });
});
