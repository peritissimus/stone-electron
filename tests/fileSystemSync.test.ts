import { describe, it, beforeAll, expect } from 'vitest';
import fs from 'fs/promises';
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

describe('File system sync and fetch', () => {
  const tmpRoot = path.join(process.cwd(), 'tests', 'tmp', `ws-fs-${Date.now()}`);
  const repos = new Repositories();

  beforeAll(async () => {
    // Init DB (uses mocked electron app path from tests/setup)
    const db = getDatabaseManager();
    await db.initialize();

    // Create folder structure with markdown files
    await writeMarkdown(path.join(tmpRoot, 'Personal', 'Note A.md'), '# Personal A', {
      tags: ['ideas'],
      favorite: true,
    });
    await writeMarkdown(path.join(tmpRoot, 'Work', 'Note B.md'), '# Work B');
    await writeMarkdown(path.join(tmpRoot, 'Work', 'ProjectX', 'Note C.md'), '# Work ProjectX C');

    // Create workspace pointing to tmpRoot
    const ws = await repos.workspace.create({ name: 'FS Test', folderPath: tmpRoot });

    // Sync notebooks from folders, then notes from files
    await repos.notebook.syncWithWorkspaceFolders(ws.id);
    await repos.note.syncWithFileSystem(ws.id);
  });

  it('creates notebooks for each folder', async () => {
    const list = await repos.notebook.getFlatList();
    const folders = list.map((n) => n.folderPath);
    expect(folders).toContain('Personal');
    expect(folders).toContain('Work');
    // Nested folder
    expect(folders).toContain('Work/ProjectX');
  });

  it('finds notes by folder (including nested)', async () => {
    const personal = await repos.note.findByFolder('Personal');
    const work = await repos.note.findByFolder('Work');
    expect(personal.length).toBe(1);
    expect(work.length).toBe(2);
  });

  it('assigns notebookId for imported notes', async () => {
    const list = await repos.notebook.getFlatList();
    const personal = list.find((n) => n.folderPath === 'Personal');
    expect(personal).toBeTruthy();
    const notesInPersonal = await repos.note.findByNotebook(personal!.id);
    expect(notesInPersonal.length).toBe(1);
  });
});
