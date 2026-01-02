/**
 * NoteLinkRepository Tests
 *
 * Covers link creation, retrieval, counting, and deletion helpers.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'node:path';
import { setupTestDatabase } from '../helpers/testDatabase';
import { getDatabaseManager } from '../../src/main/database/DatabaseManager';
import { notes, noteLinks } from '../../src/main/database/schema';
import { NoteLinkRepository } from '../../src/main/repositories/NoteLinkRepository';
import { NoteRepository } from '../../src/main/repositories/NoteRepository';
import { WorkspaceRepository } from '../../src/main/repositories/WorkspaceRepository';

describe('NoteLinkRepository', () => {
  let cleanup: () => Promise<void>;
  let linkRepo: NoteLinkRepository;
  let noteRepo: NoteRepository;
  let workspaceRepo: WorkspaceRepository;
  let workspacePath: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;

    linkRepo = new NoteLinkRepository();
    noteRepo = new NoteRepository();
    workspaceRepo = new WorkspaceRepository();

    workspacePath = path.join(process.cwd(), 'tests', 'tmp', `links-workspace-${Date.now()}`);
    fs.mkdirSync(workspacePath, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Links Workspace',
      folderPath: workspacePath,
    });
    await workspaceRepo.setActive(workspace.id);
  });

  afterAll(async () => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true });
    }
    await cleanup();
  });

  beforeEach(async () => {
    const db = getDatabaseManager().getDrizzle();
    await db.delete(noteLinks);
    await db.delete(notes);
  });

  async function createNote(title: string) {
    return await noteRepo.create({ title });
  }

  it('creates and retrieves links with counts and existence checks', async () => {
    const source = await createNote('Source');
    const target = await createNote('Target');

    await linkRepo.addLink(source.id, target.id);

    expect(await linkRepo.linkExists(source.id, target.id)).toBe(true);

    const allLinks = await linkRepo.getAll();
    expect(allLinks).toHaveLength(1);

    const backlinks = await linkRepo.getBacklinks(target.id);
    expect(backlinks.map((n) => n.id)).toEqual([source.id]);

    const forward = await linkRepo.getForwardLinks(source.id);
    expect(forward.map((n) => n.id)).toEqual([target.id]);

    const countsSource = await linkRepo.countLinksForNote(source.id);
    const countsTarget = await linkRepo.countLinksForNote(target.id);
    expect(countsSource).toEqual({ incoming: 0, outgoing: 1 });
    expect(countsTarget).toEqual({ incoming: 1, outgoing: 0 });
  });

  it('removes links and clears by source/target', async () => {
    const a = await createNote('A');
    const b = await createNote('B');
    const c = await createNote('C');

    await linkRepo.addLink(a.id, b.id);
    await linkRepo.addLink(a.id, c.id);
    await linkRepo.addLink(b.id, c.id);

    await linkRepo.removeAllLinksFromNote(a.id);
    expect(await linkRepo.linkExists(a.id, b.id)).toBe(false);
    expect(await linkRepo.getForwardLinks(a.id)).toHaveLength(0);

    await linkRepo.removeAllLinksToNote(c.id);
    expect(await linkRepo.linkExists(b.id, c.id)).toBe(false);
  });

  it('removes duplicate links via removeLink', async () => {
    const a = await createNote('A');
    const b = await createNote('B');

    await linkRepo.addLink(a.id, b.id);
    await linkRepo.addLink(a.id, b.id); // onConflictDoNothing

    expect((await linkRepo.getAll()).length).toBeGreaterThanOrEqual(1);

    await linkRepo.removeLink(a.id, b.id);
    expect(await linkRepo.linkExists(a.id, b.id)).toBe(false);
  });
});
