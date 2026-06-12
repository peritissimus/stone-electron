import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { topics } from '../../../../src/main/shared/database/schema';

vi.mock('node:os', () => ({
  default: {
    homedir: () => '/tmp/stone-dbmanager-home',
    tmpdir: () => '/tmp',
  },
  homedir: () => '/tmp/stone-dbmanager-home',
  tmpdir: () => '/tmp',
}));

describe('DatabaseManager', () => {
  let root: string;
  let previousDatabaseUrl: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    previousDatabaseUrl = process.env.DATABASE_URL;
    root = await fs.mkdtemp('/tmp/stone-dbmanager-');
    process.env.DATABASE_URL = path.join(root, 'notes.db');
    await fs.rm('/tmp/stone-dbmanager-home', {
      recursive: true,
      force: true,
    });
  });

  afterEach(async () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm('/tmp/stone-dbmanager-home', {
      recursive: true,
      force: true,
    });
  });

  it('initializes, seeds predefined topics, reports health, and reopens after close', async () => {
    const { createDatabaseManager } = await import('../../../../src/main/infrastructure/database/DatabaseManager');
    const manager = createDatabaseManager();

    expect(manager.getDbPath()).toBe(process.env.DATABASE_URL);
    expect(manager.getDataPath()).toBe(root);
    expect(() => manager.getDrizzle()).toThrow('Database not initialized');

    await manager.initialize();
    await manager.initialize();

    const db = manager.getDrizzle();
    const seededTopics = await db.select().from(topics);
    expect(seededTopics.map((topic: { id: string }) => topic.id).sort()).toEqual([
      'topic_ideas',
      'topic_learning',
      'topic_personal',
      'topic_projects',
      'topic_work',
    ]);

    await expect(manager.checkIntegrity()).resolves.toEqual({ ok: true, errors: [] });
    await expect(manager.getStatus()).resolves.toMatchObject({
      path: process.env.DATABASE_URL,
      isOpen: true,
    });

    await manager.vacuum();
    await manager.optimize();
    await manager.close();
    await expect(manager.getStatus()).resolves.toMatchObject({ isOpen: false });

    await manager.initialize();
    expect(manager.getClient()).not.toBeNull();
    await manager.close();
  });
});
