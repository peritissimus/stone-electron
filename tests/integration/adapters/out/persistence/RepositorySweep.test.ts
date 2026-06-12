import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AttachmentRepository } from '../../../../../src/main/adapters/out/persistence/AttachmentRepository';
import { IndexRepository } from '../../../../../src/main/adapters/out/persistence/IndexRepository';
import { MeetingRecordingRepository } from '../../../../../src/main/adapters/out/persistence/MeetingRecordingRepository';
import { NoteLinkRepository } from '../../../../../src/main/adapters/out/persistence/NoteLinkRepository';
import { NotebookRepository } from '../../../../../src/main/adapters/out/persistence/NotebookRepository';
import { SettingsRepository } from '../../../../../src/main/adapters/out/persistence/SettingsRepository';
import { TagRepository } from '../../../../../src/main/adapters/out/persistence/TagRepository';
import { TopicRepository } from '../../../../../src/main/adapters/out/persistence/TopicRepository';
import { VersionRepository } from '../../../../../src/main/adapters/out/persistence/VersionRepository';
import { WorkspaceRepository } from '../../../../../src/main/adapters/out/persistence/WorkspaceRepository';
import { AttachmentEntity } from '../../../../../src/main/domain/entities/Attachment';
import { MeetingRecordingEntity } from '../../../../../src/main/domain/entities/MeetingRecording';
import { NoteLinkEntity } from '../../../../../src/main/domain/entities/NoteLink';
import { NotebookEntity } from '../../../../../src/main/domain/entities/Notebook';
import { TagEntity } from '../../../../../src/main/domain/entities/Tag';
import { TopicEntity } from '../../../../../src/main/domain/entities/Topic';
import { VersionEntity } from '../../../../../src/main/domain/entities/Version';
import { WorkspaceEntity } from '../../../../../src/main/domain/entities/Workspace';
import { noteTopics, topics } from '../../../../../src/main/shared/database/schema';
import { createMainTestDatabase, seedNote, seedWorkspace, type TestDatabase } from '../../../../helpers/mainDb';

describe('remaining persistence adapters', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createMainTestDatabase();
    await seedWorkspace(testDb.db, 'ws-1');
    await seedWorkspace(testDb.db, 'ws-2');
    await seedNote(testDb.db, 'note-a');
    await seedNote(testDb.db, 'note-b');
    await seedNote(testDb.db, 'note-c', 'ws-2');
  });

  afterEach(async () => {
    await testDb.close();
  });

  it('persists workspace lifecycle and active selection', async () => {
    const repository = new WorkspaceRepository({ db: testDb.db as any });
    const workspace = WorkspaceEntity.create({
      id: 'ws-new',
      name: 'New Workspace',
      folderPath: '/tmp/ws-new',
    });

    await repository.save(workspace);
    expect(await repository.exists('ws-new')).toBe(true);
    expect(await repository.findByFolderPath('/tmp/ws-new')).toMatchObject({ id: 'ws-new' });

    workspace.rename('Renamed Workspace');
    await repository.save(workspace);
    await repository.setActive('ws-new');

    expect(await repository.findActive()).toMatchObject({
      id: 'ws-new',
      name: 'Renamed Workspace',
      isActive: true,
    });

    await repository.delete('ws-new');
    expect(await repository.findById('ws-new')).toBeNull();
  });

  it('persists notebook trees, counts, and positions', async () => {
    const repository = new NotebookRepository({ db: testDb.db as any });
    const root = NotebookEntity.create({
      id: 'nb-root',
      name: 'Root',
      workspaceId: 'ws-1',
      folderPath: 'root',
      position: 2,
    });
    const child = NotebookEntity.create({
      id: 'nb-child',
      name: 'Child',
      parentId: 'nb-root',
      workspaceId: 'ws-1',
      folderPath: 'root/child',
      position: 3,
    });

    await repository.save(root);
    await repository.save(child);
    await testDb.db
      .update((await import('../../../../../src/main/shared/database/schema')).notes)
      .set({ notebookId: 'nb-child' })
      .where(eq((await import('../../../../../src/main/shared/database/schema')).notes.id, 'note-a'));

    expect(await repository.findById('nb-root')).toMatchObject({ name: 'Root' });
    expect(await repository.findByFolderPath('root/child', 'ws-1')).toMatchObject({ id: 'nb-child' });
    expect((await repository.findByParentId('nb-root', 'ws-1')).map((n) => n.id)).toEqual(['nb-child']);
    expect(await repository.getAncestorIds('nb-child')).toEqual(['nb-root']);
    expect(await repository.getDescendantIds('nb-root')).toEqual(['nb-child']);
    expect(await repository.count('ws-1')).toBe(2);
    expect(await repository.findAllWithCounts('ws-1')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'nb-child', noteCount: 1 })]),
    );

    await repository.updatePositions([{ id: 'nb-child', position: 0 }]);
    expect(await repository.findById('nb-child')).toMatchObject({ position: 0 });
  });

  it('persists tags and note-tag relationships', async () => {
    const repository = new TagRepository({ db: testDb.db as any });
    const urgent = TagEntity.create({ id: 'tag-urgent', name: 'Urgent Work', color: '#ef4444' });
    const research = TagEntity.create({ id: 'tag-research', name: 'Research', color: '#22c55e' });

    await repository.save(urgent);
    await repository.save(research);
    await repository.addTagToNote('note-a', urgent.id);
    await repository.addTagToNote('note-a', research.id);
    await repository.addTagToNote('note-b', urgent.id);

    expect(await repository.findByName(' urgent-work ')).toMatchObject({ id: urgent.id });
    expect((await repository.getNoteTags('note-a')).map((t) => t.name).sort()).toEqual([
      'research',
      'urgent-work',
    ]);
    expect(await repository.findAllWithCounts()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: urgent.id, noteCount: 2 })]),
    );

    await repository.setNoteTags('note-a', [urgent.id]);
    expect((await repository.getTagsForNotes(['note-a', 'note-b', 'missing'])).get('missing')).toEqual([]);
    expect((await repository.findByNoteId('note-a')).map((t) => t.id)).toEqual([urgent.id]);

    await repository.delete(urgent.id);
    expect(await repository.exists(urgent.id)).toBe(false);
  });

  it('persists topics and note-topic relationships', async () => {
    const repository = new TopicRepository({ db: testDb.db as any });
    const topic = TopicEntity.create({
      id: 'topic-ai',
      name: 'AI',
      description: 'Machine learning notes',
      color: '#6366f1',
      isPredefined: true,
    });
    const project = TopicEntity.create({ id: 'topic-project', name: 'Project' });

    await repository.save(topic);
    await repository.save(project);
    await repository.assignNoteToTopic('note-a', topic.id, 0.9);
    await repository.assignToNote('note-b', topic.id, { confidence: 0.7, isManual: true });

    expect(await repository.findById(topic.id)).toMatchObject({ name: 'AI', isPredefined: true });
    expect(await repository.findPredefined()).toHaveLength(1);
    expect(await repository.getNoteIdsByTopic(topic.id)).toEqual(['note-a', 'note-b']);
    expect(await repository.countNotesByTopic(topic.id)).toBe(2);
    expect(await repository.findAllWithCounts()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: topic.id, noteCount: 2 })]),
    );
    expect((await repository.getTopicsForNote('note-a'))[0]).toMatchObject({
      noteId: 'note-a',
      topicId: topic.id,
      topicName: 'AI',
    });

    await repository.updateCentroid(topic.id, new Uint8Array([1, 2, 3, 4]));
    const centroid = (await repository.find(topic.id))?.centroid;
    expect(Array.from(centroid ?? [])).toEqual([1, 2, 3, 4]);

    await repository.clearAutoTopicsForNote('note-a');
    expect(await repository.getNotesForTopic(topic.id)).toEqual([
      expect.objectContaining({ noteId: 'note-b' }),
    ]);

    await repository.setTopicsForNote('note-c', [{ topicId: project.id, confidence: 0.5 }]);
    expect((await repository.getTopicsForNotes(['note-c'])).get('note-c')).toHaveLength(1);

    await repository.removeFromNote('note-c', project.id);
    await repository.delete(project.id);
    expect(await repository.exists(project.id)).toBe(false);
  });

  it('persists attachments and note links', async () => {
    const attachments = new AttachmentRepository({ db: testDb.db as any });
    const links = new NoteLinkRepository({ db: testDb.db as any });
    const attachment = AttachmentEntity.create({
      id: 'att-1',
      noteId: 'note-a',
      filename: 'diagram.png',
      mimeType: 'image/png',
      size: 128,
      path: 'attachments/diagram.png',
    });

    await attachments.save(attachment);
    expect(await attachments.findById('att-1')).toMatchObject({ filename: 'diagram.png' });
    expect(await attachments.countByNoteId('note-a')).toBe(1);
    expect((await attachments.findByNoteIds(['note-a', 'note-b'])).get('note-b')).toEqual([]);

    await links.save(NoteLinkEntity.create({ sourceNoteId: 'note-a', targetNoteId: 'note-b' }));
    await links.save(NoteLinkEntity.create({ sourceNoteId: 'note-b', targetNoteId: 'note-a' }));

    expect(await links.exists('note-a', 'note-b')).toBe(true);
    expect((await links.getForwardLinks('note-a'))[0]).toMatchObject({ id: 'note-b' });
    expect((await links.getBacklinks('note-a'))[0]).toMatchObject({ id: 'note-b' });
    expect(await links.countForNote('note-a')).toEqual({ outgoing: 1, incoming: 1 });

    await links.setLinksFromNote('note-a', ['note-c']);
    expect((await links.findAll()).map((link) => link.targetNoteId).sort()).toEqual([
      'note-a',
      'note-c',
    ]);

    await attachments.deleteByNoteId('note-a');
    await links.deleteAllForNote('note-a');
    expect(await attachments.exists('att-1')).toBe(false);
    expect(await links.findAll()).toEqual([]);
  });

  it('persists versions and prunes old snapshots', async () => {
    const repository = new VersionRepository({ db: testDb.db as any });
    const versions = [1, 2, 3].map((versionNumber) =>
      VersionEntity.create({
        id: `ver-${versionNumber}`,
        noteId: 'note-a',
        title: `Title ${versionNumber}`,
        content: `content ${versionNumber}`,
        versionNumber,
      }),
    );

    for (const version of versions) {
      await repository.save(version);
    }

    expect(await repository.getNextVersionNumber('note-a')).toBe(4);
    expect(await repository.getLatestVersion('note-a')).toMatchObject({ id: 'ver-3' });
    expect((await repository.getVersionSummary('note-a'))[0]).toMatchObject({
      id: 'ver-3',
      contentLength: 'content 3'.length,
    });

    expect(await repository.pruneVersions('note-a', 1)).toBe(2);
    expect(await repository.countByNoteId('note-a')).toBe(1);

    await repository.deleteByNoteId('note-a');
    expect(await repository.findByNoteId('note-a')).toEqual([]);
  });

  it('persists meeting recordings and paginates by cursor', async () => {
    const repository = new MeetingRecordingRepository({ db: testDb.db as any });
    const first = MeetingRecordingEntity.create({
      id: 'rec-1',
      workspaceId: 'ws-1',
      title: 'Planning',
      audioPath: '.stone/recordings/one.wav',
    });
    first.markTranscribing();
    first.attachTranscript('hello world', [{ text: 'hello', startMs: 0, endMs: 500 }], 500);
    first.attachSummary('summary', 'prompt');

    const second = MeetingRecordingEntity.fromPersistence({
      ...first.toPersistence(),
      id: 'rec-2',
      title: 'Follow up',
      createdAt: new Date(first.createdAt.getTime() + 1000),
      updatedAt: new Date(first.updatedAt.getTime() + 1000),
    });

    await repository.save(first);
    await repository.save(second);

    expect(await repository.findById('rec-1')).toMatchObject({
      id: 'rec-1',
      status: 'ready',
      transcriptText: 'hello world',
    });

    const page = await repository.list({ workspaceId: 'ws-1', limit: 1 });
    expect(page.recordings).toHaveLength(1);
    expect(page.recordings[0].id).toBe('rec-2');
    expect(page.nextCursor).toBeInstanceOf(Date);

    const nextPage = await repository.list({ workspaceId: 'ws-1', limit: 1, cursor: page.nextCursor! });
    expect(nextPage.recordings[0].id).toBe('rec-1');

    await repository.delete('rec-1');
    expect(await repository.findById('rec-1')).toBeNull();
  });

  it('persists free-form settings and chunk index records/search', async () => {
    const settings = new SettingsRepository({ db: testDb.db as any });
    await settings.set('legacy.key', 'one');
    await settings.set('legacy.key', 'two');
    expect(await settings.get('legacy.key')).toMatchObject({ value: 'two' });
    expect(await settings.getAll()).toHaveLength(1);
    await settings.delete('legacy.key');
    expect(await settings.get('legacy.key')).toBeNull();

    const index = new IndexRepository({ db: testDb.db as any });
    const now = new Date('2026-01-05T00:00:00.000Z');
    await index.upsertStatus({
      noteId: 'note-a',
      workspaceId: 'ws-1',
      contentHash: 'hash-a',
      chunkCount: 2,
      indexedAt: now,
      model: 'test-model',
      dimensions: 3,
      status: 'indexed',
      error: null,
    });
    await index.upsertStatus({
      noteId: 'note-b',
      workspaceId: 'ws-1',
      contentHash: 'hash-b',
      chunkCount: 0,
      indexedAt: null,
      model: null,
      dimensions: null,
      status: 'failed',
      error: 'bad',
    });

    await index.replaceChunks('note-a', 'ws-1', 'Alpha Note', [
      {
        id: 'chunk-1',
        noteId: 'note-a',
        workspaceId: 'ws-1',
        chunkIndex: 0,
        headingPath: ['Alpha'],
        text: 'alpha semantic text',
        contentHash: 'chunk-hash-1',
        tokenCount: 3,
        embedding: [1, 0, 0],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'chunk-2',
        noteId: 'note-a',
        workspaceId: 'ws-1',
        chunkIndex: 1,
        headingPath: ['Beta'],
        text: 'beta reference text',
        contentHash: 'chunk-hash-2',
        tokenCount: 3,
        embedding: [0, 1, 0],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    expect(await index.getStatus('note-a')).toMatchObject({
      noteId: 'note-a',
      status: 'indexed',
      model: 'test-model',
    });
    expect(await index.getWorkspaceStats('ws-1')).toMatchObject({
      totalNotes: 2,
      indexedNotes: 1,
      failedNotes: 1,
      chunkCount: 2,
    });
    expect((await index.searchFullText('alpha', { workspaceId: 'ws-1', limit: 5 }))[0].chunk.id).toBe(
      'chunk-1',
    );
    expect((await index.searchVector([0.9, 0, 0], { workspaceId: 'ws-1', limit: 5 }))[0].chunk.id).toBe(
      'chunk-1',
    );
    expect(await index.getNoteVector('note-a')).toEqual([0.5, 0.5, 0]);
    expect((await index.findSimilarNotesByVector([1, 0, 0], { workspaceId: 'ws-1', limit: 5 }))[0]).toMatchObject({
      noteId: 'note-a',
      matchedChunks: 2,
    });
    expect(await index.getChunksForWorkspace('ws-1')).toHaveLength(2);

    await testDb.db.insert(topics).values({
      id: 'topic-extra',
      name: 'Extra',
      createdAt: now,
      updatedAt: now,
    });
    await testDb.db.insert(noteTopics).values({
      noteId: 'note-a',
      topicId: 'topic-extra',
      confidence: 0.5,
      isManual: false,
      createdAt: now,
    });

    await index.deleteByNoteId('note-a');
    expect(await index.getStatus('note-a')).toBeNull();
    expect(await index.getChunksForWorkspace('ws-1')).toEqual([]);
  });
});
