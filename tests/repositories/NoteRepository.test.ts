/**
 * NoteRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { NoteRepository } from '@main/repositories/NoteRepository'
import { NotebookRepository } from '@main/repositories/NotebookRepository'
import { TagRepository } from '@main/repositories/TagRepository'
import { createTestDatabase, cleanupTestDatabase } from '../helpers/testDatabase'
import type { Note } from '@shared/types'

describe('NoteRepository', () => {
  let db: Database.Database
  let noteRepo: NoteRepository
  let notebookRepo: NotebookRepository
  let tagRepo: TagRepository

  beforeEach(() => {
    db = createTestDatabase()
    noteRepo = new NoteRepository(db)
    notebookRepo = new NotebookRepository(db)
    tagRepo = new TagRepository(db)
  })

  afterEach(() => {
    cleanupTestDatabase(db)
  })

  describe('create', () => {
    it('should create a note with default values', () => {
      const note = noteRepo.create({
        title: 'Test Note',
        content: 'Test content',
      })

      expect(note).toBeDefined()
      expect(note.id).toBeDefined()
      expect(note.title).toBe('Test Note')
      expect(note.content).toBe('Test content')
      expect(note.is_favorite).toBe(0)
      expect(note.is_pinned).toBe(0)
      expect(note.is_archived).toBe(0)
      expect(note.is_deleted).toBe(0)
      expect(note.created_at).toBeDefined()
      expect(note.updated_at).toBeDefined()
    })

    it('should create a note in a notebook', () => {
      const notebook = notebookRepo.create({ name: 'Work' })
      const note = noteRepo.create({
        title: 'Meeting Notes',
        content: 'Important meeting',
        notebook_id: notebook.id,
      })

      expect(note.notebook_id).toBe(notebook.id)
    })
  })

  describe('findById', () => {
    it('should find a note by id', () => {
      const created = noteRepo.create({
        title: 'Find Me',
        content: 'Test',
      })

      const found = noteRepo.findById(created.id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
      expect(found?.title).toBe('Find Me')
    })

    it('should return null for non-existent note', () => {
      const found = noteRepo.findById('non-existent-id')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('should update note title and content', () => {
      const note = noteRepo.create({
        title: 'Original',
        content: 'Original content',
      })

      const updated = noteRepo.update(note.id, {
        title: 'Updated',
        content: 'Updated content',
      })

      expect(updated.title).toBe('Updated')
      expect(updated.content).toBe('Updated content')
      expect(updated.updated_at).toBeGreaterThanOrEqual(note.updated_at)
    })

    it('should update note flags', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })

      const updated = noteRepo.update(note.id, {
        is_favorite: 1,
        is_pinned: 1,
      })

      expect(updated.is_favorite).toBe(1)
      expect(updated.is_pinned).toBe(1)
    })
  })

  describe('delete', () => {
    it('should delete a note', () => {
      const note = noteRepo.create({ title: 'Delete Me', content: 'Test' })
      const deleted = noteRepo.delete(note.id)

      expect(deleted).toBe(true)
      expect(noteRepo.findById(note.id)).toBeNull()
    })
  })

  describe('softDelete and restore', () => {
    it('should soft delete a note', () => {
      const note = noteRepo.create({ title: 'Soft Delete', content: 'Test' })
      const deleted = noteRepo.softDelete(note.id)

      expect(deleted.is_deleted).toBe(1)
      expect(deleted.deleted_at).toBeDefined()
      expect(deleted.deleted_at).toBeGreaterThan(0)
    })

    it('should restore a soft-deleted note', () => {
      const note = noteRepo.create({ title: 'Restore Me', content: 'Test' })
      noteRepo.softDelete(note.id)
      const restored = noteRepo.restore(note.id)

      expect(restored.is_deleted).toBe(0)
      expect(restored.deleted_at).toBeNull()
    })
  })

  describe('toggleFavorite', () => {
    it('should toggle favorite status on', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const toggled = noteRepo.toggleFavorite(note.id)

      expect(toggled.is_favorite).toBe(1)
    })

    it('should toggle favorite status off', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test', is_favorite: 1 })
      const toggled = noteRepo.toggleFavorite(note.id)

      expect(toggled.is_favorite).toBe(0)
    })
  })

  describe('togglePin', () => {
    it('should toggle pin status', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })

      let toggled = noteRepo.togglePin(note.id)
      expect(toggled.is_pinned).toBe(1)

      toggled = noteRepo.togglePin(note.id)
      expect(toggled.is_pinned).toBe(0)
    })
  })

  describe('toggleArchive', () => {
    it('should toggle archive status', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })

      let toggled = noteRepo.toggleArchive(note.id)
      expect(toggled.is_archived).toBe(1)

      toggled = noteRepo.toggleArchive(note.id)
      expect(toggled.is_archived).toBe(0)
    })
  })

  describe('findByNotebook', () => {
    it('should find all notes in a notebook', () => {
      const notebook = notebookRepo.create({ name: 'Work' })

      noteRepo.create({ title: 'Note 1', content: 'Test', notebook_id: notebook.id })
      noteRepo.create({ title: 'Note 2', content: 'Test', notebook_id: notebook.id })
      noteRepo.create({ title: 'Note 3', content: 'Test' }) // No notebook

      const notes = noteRepo.findByNotebook(notebook.id)
      expect(notes).toHaveLength(2)
    })

    it('should not return deleted notes', () => {
      const notebook = notebookRepo.create({ name: 'Work' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test', notebook_id: notebook.id })
      noteRepo.create({ title: 'Note 2', content: 'Test', notebook_id: notebook.id })
      noteRepo.softDelete(note1.id)

      const notes = noteRepo.findByNotebook(notebook.id)
      expect(notes).toHaveLength(1)
    })
  })

  describe('findByTag', () => {
    it('should find notes by tag', () => {
      const tag = tagRepo.create({ name: 'important', color: '#ff0000' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Note 2', content: 'Test' })
      const note3 = noteRepo.create({ title: 'Note 3', content: 'Test' })

      tagRepo.addToNote(tag.id, note1.id)
      tagRepo.addToNote(tag.id, note2.id)

      const notes = noteRepo.findByTag(tag.id)
      expect(notes).toHaveLength(2)
      expect(notes.map(n => n.id)).toContain(note1.id)
      expect(notes.map(n => n.id)).toContain(note2.id)
      expect(notes.map(n => n.id)).not.toContain(note3.id)
    })
  })

  describe('getFavorites', () => {
    it('should return only favorite notes', () => {
      noteRepo.create({ title: 'Favorite 1', content: 'Test', is_favorite: 1 })
      noteRepo.create({ title: 'Favorite 2', content: 'Test', is_favorite: 1 })
      noteRepo.create({ title: 'Normal', content: 'Test', is_favorite: 0 })

      const favorites = noteRepo.getFavorites()
      expect(favorites).toHaveLength(2)
      expect(favorites.every(n => n.is_favorite === 1)).toBe(true)
    })
  })

  describe('getPinned', () => {
    it('should return only pinned notes', () => {
      noteRepo.create({ title: 'Pinned 1', content: 'Test', is_pinned: 1 })
      noteRepo.create({ title: 'Pinned 2', content: 'Test', is_pinned: 1 })
      noteRepo.create({ title: 'Normal', content: 'Test', is_pinned: 0 })

      const pinned = noteRepo.getPinned()
      expect(pinned).toHaveLength(2)
      expect(pinned.every(n => n.is_pinned === 1)).toBe(true)
    })
  })

  describe('getRecent', () => {
    it('should return recent notes ordered by updated_at', () => {
      const note1 = noteRepo.create({ title: 'Old', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Recent', content: 'Test' })
      const note3 = noteRepo.create({ title: 'Newest', content: 'Test' })

      const recent = noteRepo.getRecent(10)
      expect(recent).toHaveLength(3)
      expect(recent[0].id).toBe(note3.id)
      expect(recent[1].id).toBe(note2.id)
      expect(recent[2].id).toBe(note1.id)
    })

    it('should limit results', () => {
      for (let i = 0; i < 5; i++) {
        noteRepo.create({ title: `Note ${i}`, content: 'Test' })
      }

      const recent = noteRepo.getRecent(3)
      expect(recent).toHaveLength(3)
    })
  })

  describe('getDeleted', () => {
    it('should return only deleted notes', () => {
      const note1 = noteRepo.create({ title: 'Delete 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Delete 2', content: 'Test' })
      noteRepo.create({ title: 'Keep', content: 'Test' })

      noteRepo.softDelete(note1.id)
      noteRepo.softDelete(note2.id)

      const deleted = noteRepo.getDeleted()
      expect(deleted).toHaveLength(2)
      expect(deleted.every(n => n.is_deleted === 1)).toBe(true)
    })
  })

  describe('getArchived', () => {
    it('should return only archived notes', () => {
      noteRepo.create({ title: 'Archive 1', content: 'Test', is_archived: 1 })
      noteRepo.create({ title: 'Archive 2', content: 'Test', is_archived: 1 })
      noteRepo.create({ title: 'Active', content: 'Test', is_archived: 0 })

      const archived = noteRepo.getArchived()
      expect(archived).toHaveLength(2)
      expect(archived.every(n => n.is_archived === 1)).toBe(true)
    })
  })

  describe('findByDateRange', () => {
    it('should find notes within date range', () => {
      const now = Math.floor(Date.now() / 1000)
      const yesterday = now - 86400
      const tomorrow = now + 86400

      noteRepo.create({ title: 'Note', content: 'Test' })

      const notes = noteRepo.findByDateRange(yesterday, tomorrow)
      expect(notes).toHaveLength(1)
    })

    it('should not return notes outside date range', () => {
      const now = Math.floor(Date.now() / 1000)
      const twoDaysAgo = now - (86400 * 2)
      const yesterday = now - 86400

      noteRepo.create({ title: 'Note', content: 'Test' })

      const notes = noteRepo.findByDateRange(twoDaysAgo, yesterday)
      expect(notes).toHaveLength(0)
    })
  })

  describe('findByTags', () => {
    it('should find notes with all specified tags (AND logic)', () => {
      const tag1 = tagRepo.create({ name: 'work', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'urgent', color: '#00ff00' })

      const note1 = noteRepo.create({ title: 'Work and Urgent', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Only Work', content: 'Test' })

      tagRepo.addToNote(tag1.id, note1.id)
      tagRepo.addToNote(tag2.id, note1.id)
      tagRepo.addToNote(tag1.id, note2.id)

      const notes = noteRepo.findByTags([tag1.id, tag2.id])
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(note1.id)
    })
  })

  describe('permanentDelete', () => {
    it('should permanently delete note and all related data', () => {
      const tag = tagRepo.create({ name: 'test', color: '#ff0000' })
      const note = noteRepo.create({ title: 'Delete Me', content: 'Test' })

      tagRepo.addToNote(tag.id, note.id)

      const deleted = noteRepo.permanentDelete(note.id)
      expect(deleted).toBe(true)
      expect(noteRepo.findById(note.id)).toBeNull()

      // Verify tag associations are deleted
      const tagAssociations = db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(note.id)
      expect(tagAssociations).toHaveLength(0)
    })
  })
})
