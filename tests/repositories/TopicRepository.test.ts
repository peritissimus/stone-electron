/**
 * TopicRepository Tests
 *
 * Exercises topic CRUD, counts, assignments, and centroid updates.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'node:path';
import { setupTestDatabase } from '../helpers/testDatabase';
import { getDatabaseManager } from '../../src/main/database/DatabaseManager';
import { notes, topics, noteTopics } from '../../src/main/database/schema';
import { TopicRepository } from '../../src/main/repositories/TopicRepository';
import { NoteRepository } from '../../src/main/repositories/NoteRepository';
import { WorkspaceRepository } from '../../src/main/repositories/WorkspaceRepository';

describe('TopicRepository', () => {
  let cleanup: () => Promise<void>;
  let topicRepo: TopicRepository;
  let noteRepo: NoteRepository;
  let workspaceRepo: WorkspaceRepository;
  let workspacePath: string;
  let noteA: { id: string; title: string; filePath: string | null; workspaceId: string | null };
  let noteB: { id: string; title: string; filePath: string | null; workspaceId: string | null };

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;

    topicRepo = new TopicRepository();
    noteRepo = new NoteRepository();
    workspaceRepo = new WorkspaceRepository();

    workspacePath = path.join(process.cwd(), 'tests', 'tmp', `topics-workspace-${Date.now()}`);
    fs.mkdirSync(workspacePath, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Topics Workspace',
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
    await db.delete(noteTopics);
    await db.delete(topics);
    await db.delete(notes);

    noteA = await noteRepo.create({ title: 'Alpha' });
    noteB = await noteRepo.create({ title: 'Beta' });
  });

  it('creates, finds, updates, and deletes topics', async () => {
    const created = await topicRepo.create({ name: 'AI', description: 'test' });

    expect(created.id).toBeDefined();
    expect(created.color).toBe('#6366f1');

    const byId = await topicRepo.findById(created.id);
    const byName = await topicRepo.findByName('AI');
    expect(byId?.name).toBe('AI');
    expect(byName?.id).toBe(created.id);

    const updated = await topicRepo.update(created.id, { color: '#ff0000' });
    expect(updated.color).toBe('#ff0000');

    const deleted = await topicRepo.delete(created.id);
    expect(deleted).toBe(true);
    expect(await topicRepo.findById(created.id)).toBeUndefined();
  });

  it('returns lists with predefined ordering and counts', async () => {
    await topicRepo.create({ name: 'Zeta', isPredefined: true });
    await topicRepo.create({ name: 'Alpha Topic' });

    const all = await topicRepo.getAll();
    expect(all[0].isPredefined).toBe(true);

    const predefined = await topicRepo.getPredefined();
    expect(predefined).toHaveLength(1);
  });

  it('assigns topics to notes and updates counts', async () => {
    const topic = await topicRepo.create({ name: 'Links' });
    await topicRepo.assignToNote(noteA.id, topic.id, { confidence: 0.9, isManual: true });

    const topicsForNote = await topicRepo.getTopicsForNote(noteA.id);
    expect(topicsForNote[0]).toMatchObject({
      noteId: noteA.id,
      topicId: topic.id,
      topicName: 'Links',
      isManual: true,
    });

    const notesForTopic = await topicRepo.getNotesForTopic(topic.id);
    expect(notesForTopic[0]).toMatchObject({ noteId: noteA.id });

    const counts = await topicRepo.getAllWithCounts();
    expect(counts.find((t) => t.id === topic.id)?.noteCount).toBe(1);

    await topicRepo.removeFromNote(noteA.id, topic.id);
    const afterRemove = await topicRepo.getAllWithCounts();
    expect(afterRemove.find((t) => t.id === topic.id)?.noteCount).toBe(0);
  });

  it('sets topics for a note and updates affected counts', async () => {
    const t1 = await topicRepo.create({ name: 'One' });
    const t2 = await topicRepo.create({ name: 'Two' });

    await topicRepo.setTopicsForNote(noteA.id, [{ topicId: t1.id }]);
    await topicRepo.setTopicsForNote(noteA.id, [{ topicId: t2.id, confidence: 0.5 }]);

    const topicsForNote = await topicRepo.getTopicsForNote(noteA.id);
    expect(topicsForNote).toHaveLength(1);
    expect(topicsForNote[0].topicId).toBe(t2.id);

    const updatedT1 = await topicRepo.findById(t1.id);
    const updatedT2 = await topicRepo.findById(t2.id);
    expect(updatedT1?.noteCount).toBe(0);
    expect(updatedT2?.noteCount).toBe(1);
  });

  it('gets topics for multiple notes grouped in a map', async () => {
    const t1 = await topicRepo.create({ name: 'Group' });
    await topicRepo.assignToNote(noteA.id, t1.id, { confidence: 0.8 });
    await topicRepo.assignToNote(noteB.id, t1.id, { confidence: 0.6 });

    const map = await topicRepo.getTopicsForNotes([noteA.id, noteB.id]);
    expect(map.get(noteA.id)?.length).toBe(1);
    expect(map.get(noteB.id)?.length).toBe(1);
  });

  it('respects deleted notes when fetching notes for topic', async () => {
    const t1 = await topicRepo.create({ name: 'ActiveOnly' });
    await topicRepo.assignToNote(noteA.id, t1.id);
    await topicRepo.assignToNote(noteB.id, t1.id);

    // Mark noteB as deleted
    const db = getDatabaseManager().getDrizzle();
    await db.update(notes).set({ isDeleted: true }).where(eq(notes.id, noteB.id));

    const activeNotes = await topicRepo.getNotesForTopic(t1.id);
    expect(activeNotes.map((n) => n.noteId)).toEqual([noteA.id]);
  });

  it('updates centroid using raw client', async () => {
    const t1 = await topicRepo.create({ name: 'Vector' });
    const centroid = new Uint8Array([1, 2, 3, 4]);
    await topicRepo.updateCentroid(t1.id, centroid);

    const updated = await topicRepo.findById(t1.id);
    expect(Array.from(updated?.centroid as Uint8Array)).toEqual(Array.from(centroid));
  });

  it('deletes with associations inside a transaction', async () => {
    const t1 = await topicRepo.create({ name: 'Transactional' });
    await topicRepo.assignToNote(noteA.id, t1.id);

    const transactionSpy = vi
      .spyOn(topicRepo as any, 'transaction')
      .mockImplementation(async (cb: () => any) => await cb());

    const result = await topicRepo.deleteWithAssociations(t1.id);
    expect(result).toBe(true);

    const map = await topicRepo.getTopicsForNotes([noteA.id]);
    expect(map.get(noteA.id)).toBeUndefined();

    transactionSpy.mockRestore();
  });
});
