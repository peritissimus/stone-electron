/**
 * TagRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { TagRepository } from '@main/repositories/TagRepository'
import { NoteRepository } from '@main/repositories/NoteRepository'
import { createTestDatabase, cleanupTestDatabase } from '../helpers/testDatabase'

describe('TagRepository', () => {
  let db: Database.Database
  let tagRepo: TagRepository
  let noteRepo: NoteRepository

  beforeEach(() => {
    db = createTestDatabase()
    tagRepo = new TagRepository(db)
    noteRepo = new NoteRepository(db)
  })

  afterEach(() => {
    cleanupTestDatabase(db)
  })

  describe('create', () => {
    it('should create a tag', () => {
      const tag = tagRepo.create({
        name: 'important',
        color: '#ff0000',
      })

      expect(tag).toBeDefined()
      expect(tag.id).toBeDefined()
      expect(tag.name).toBe('important')
      expect(tag.color).toBe('#ff0000')
      expect(tag.created_at).toBeDefined()
    })

    it('should create a tag with default color', () => {
      const tag = tagRepo.create({ name: 'work' })
      expect(tag.color).toBe('#3B82F6')
    })
  })

  describe('addToNote and removeFromNote', () => {
    it('should add a tag to a note', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag = tagRepo.create({ name: 'important', color: '#ff0000' })

      tagRepo.addToNote(note.id, tag.id)

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(1)
      expect(tags[0].id).toBe(tag.id)
    })

    it('should handle duplicate tag additions (idempotent)', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag = tagRepo.create({ name: 'important', color: '#ff0000' })

      tagRepo.addToNote(note.id, tag.id)
      tagRepo.addToNote(note.id, tag.id) // Add again

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(1)
    })

    it('should remove a tag from a note', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag = tagRepo.create({ name: 'important', color: '#ff0000' })

      tagRepo.addToNote(note.id, tag.id)
      tagRepo.removeFromNote(note.id, tag.id)

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(0)
    })
  })

  describe('getTagsForNote', () => {
    it('should get all tags for a note', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag1 = tagRepo.create({ name: 'work', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'urgent', color: '#00ff00' })

      tagRepo.addToNote(note.id, tag1.id)
      tagRepo.addToNote(note.id, tag2.id)

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(2)
      expect(tags.map(t => t.name)).toContain('work')
      expect(tags.map(t => t.name)).toContain('urgent')
    })

    it('should return empty array for note with no tags', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(0)
    })
  })

  describe('setTagsForNote', () => {
    it('should replace all tags for a note', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag1 = tagRepo.create({ name: 'old', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'new', color: '#00ff00' })

      tagRepo.addToNote(note.id, tag1.id)
      tagRepo.setTagsForNote(note.id, [tag2.id])

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(1)
      expect(tags[0].id).toBe(tag2.id)
    })

    it('should remove all tags when passed empty array', () => {
      const note = noteRepo.create({ title: 'Test', content: 'Test' })
      const tag = tagRepo.create({ name: 'test', color: '#ff0000' })

      tagRepo.addToNote(note.id, tag.id)
      tagRepo.setTagsForNote(note.id, [])

      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(0)
    })
  })

  describe('findOrCreate', () => {
    it('should find existing tag', () => {
      const existing = tagRepo.create({ name: 'existing', color: '#ff0000' })
      const found = tagRepo.findOrCreate('existing')

      expect(found.id).toBe(existing.id)
    })

    it('should create new tag if not found', () => {
      const created = tagRepo.findOrCreate('new-tag', '#00ff00')

      expect(created.name).toBe('new-tag')
      expect(created.color).toBe('#00ff00')
    })
  })

  describe('getAllWithCounts', () => {
    it('should return tags with note counts', () => {
      const tag1 = tagRepo.create({ name: 'popular', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'rare', color: '#00ff00' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Note 2', content: 'Test' })
      const note3 = noteRepo.create({ title: 'Note 3', content: 'Test' })

      tagRepo.addToNote(note1.id, tag1.id)
      tagRepo.addToNote(note2.id, tag1.id)
      tagRepo.addToNote(note3.id, tag2.id)

      const tagsWithCounts = tagRepo.getAllWithCounts()
      const popularTag = tagsWithCounts.find(t => t.name === 'popular')
      const rareTag = tagsWithCounts.find(t => t.name === 'rare')

      expect(popularTag?.note_count).toBe(2)
      expect(rareTag?.note_count).toBe(1)
    })

    it('should not count deleted notes', () => {
      const tag = tagRepo.create({ name: 'test', color: '#ff0000' })
      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Note 2', content: 'Test' })

      tagRepo.addToNote(note1.id, tag.id)
      tagRepo.addToNote(note2.id, tag.id)
      noteRepo.softDelete(note1.id)

      const tagsWithCounts = tagRepo.getAllWithCounts()
      const testTag = tagsWithCounts.find(t => t.name === 'test')

      expect(testTag?.note_count).toBe(1)
    })
  })

  describe('getMostUsed', () => {
    it('should return most used tags', () => {
      const tag1 = tagRepo.create({ name: 'popular', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'medium', color: '#00ff00' })
      const tag3 = tagRepo.create({ name: 'rare', color: '#0000ff' })

      const notes = [
        noteRepo.create({ title: 'Note 1', content: 'Test' }),
        noteRepo.create({ title: 'Note 2', content: 'Test' }),
        noteRepo.create({ title: 'Note 3', content: 'Test' }),
      ]

      // popular: 3 notes
      notes.forEach(note => tagRepo.addToNote(note.id, tag1.id))

      // medium: 2 notes
      tagRepo.addToNote(notes[0].id, tag2.id)
      tagRepo.addToNote(notes[1].id, tag2.id)

      // rare: 1 note
      tagRepo.addToNote(notes[0].id, tag3.id)

      const mostUsed = tagRepo.getMostUsed(3)
      expect(mostUsed[0].name).toBe('popular')
      expect(mostUsed[0].note_count).toBe(3)
      expect(mostUsed[1].name).toBe('medium')
      expect(mostUsed[1].note_count).toBe(2)
      expect(mostUsed[2].name).toBe('rare')
      expect(mostUsed[2].note_count).toBe(1)
    })

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        const tag = tagRepo.create({ name: `tag${i}`, color: '#ff0000' })
        const note = noteRepo.create({ title: 'Note', content: 'Test' })
        tagRepo.addToNote(note.id, tag.id)
      }

      const mostUsed = tagRepo.getMostUsed(3)
      expect(mostUsed).toHaveLength(3)
    })
  })

  describe('getUnused', () => {
    it('should return tags with no notes', () => {
      const usedTag = tagRepo.create({ name: 'used', color: '#ff0000' })
      const unusedTag = tagRepo.create({ name: 'unused', color: '#00ff00' })

      const note = noteRepo.create({ title: 'Note', content: 'Test' })
      tagRepo.addToNote(note.id, usedTag.id)

      const unused = tagRepo.getUnused()
      expect(unused).toHaveLength(1)
      expect(unused[0].id).toBe(unusedTag.id)
    })
  })

  describe('deleteWithAssociations', () => {
    it('should delete tag and all associations', () => {
      const tag = tagRepo.create({ name: 'delete-me', color: '#ff0000' })
      const note = noteRepo.create({ title: 'Note', content: 'Test' })

      tagRepo.addToNote(note.id, tag.id)
      tagRepo.deleteWithAssociations(tag.id)

      expect(tagRepo.findById(tag.id)).toBeNull()
      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(0)
    })
  })

  describe('searchByName', () => {
    it('should find tags by partial name', () => {
      tagRepo.create({ name: 'javascript', color: '#ff0000' })
      tagRepo.create({ name: 'typescript', color: '#00ff00' })
      tagRepo.create({ name: 'python', color: '#0000ff' })

      const results = tagRepo.searchByName('script')
      expect(results).toHaveLength(2)
      expect(results.map(t => t.name)).toContain('javascript')
      expect(results.map(t => t.name)).toContain('typescript')
    })

    it('should be case insensitive', () => {
      tagRepo.create({ name: 'JavaScript', color: '#ff0000' })

      const results = tagRepo.searchByName('javascript')
      expect(results).toHaveLength(1)
    })
  })

  describe('rename', () => {
    it('should rename a tag', () => {
      const tag = tagRepo.create({ name: 'old-name', color: '#ff0000' })
      const renamed = tagRepo.rename(tag.id, 'new-name')

      expect(renamed.name).toBe('new-name')
    })

    it('should throw error if new name already exists', () => {
      const tag1 = tagRepo.create({ name: 'tag1', color: '#ff0000' })
      tagRepo.create({ name: 'tag2', color: '#00ff00' })

      expect(() => {
        tagRepo.rename(tag1.id, 'tag2')
      }).toThrow()
    })
  })

  describe('merge', () => {
    it('should merge two tags', () => {
      const sourceTag = tagRepo.create({ name: 'source', color: '#ff0000' })
      const targetTag = tagRepo.create({ name: 'target', color: '#00ff00' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Note 2', content: 'Test' })

      tagRepo.addToNote(note1.id, sourceTag.id)
      tagRepo.addToNote(note2.id, sourceTag.id)

      tagRepo.merge(sourceTag.id, targetTag.id)

      // Source tag should be deleted
      expect(tagRepo.findById(sourceTag.id)).toBeNull()

      // Target tag should have all notes from source
      const note1Tags = tagRepo.getTagsForNote(note1.id)
      const note2Tags = tagRepo.getTagsForNote(note2.id)

      expect(note1Tags.map(t => t.id)).toContain(targetTag.id)
      expect(note2Tags.map(t => t.id)).toContain(targetTag.id)
    })

    it('should handle duplicate associations when merging', () => {
      const sourceTag = tagRepo.create({ name: 'source', color: '#ff0000' })
      const targetTag = tagRepo.create({ name: 'target', color: '#00ff00' })

      const note = noteRepo.create({ title: 'Note', content: 'Test' })

      // Note has both tags
      tagRepo.addToNote(note.id, sourceTag.id)
      tagRepo.addToNote(note.id, targetTag.id)

      tagRepo.merge(sourceTag.id, targetTag.id)

      // Should only have target tag once
      const tags = tagRepo.getTagsForNote(note.id)
      expect(tags).toHaveLength(1)
      expect(tags[0].id).toBe(targetTag.id)
    })

    it('should throw error when merging tag with itself', () => {
      const tag = tagRepo.create({ name: 'tag', color: '#ff0000' })

      expect(() => {
        tagRepo.merge(tag.id, tag.id)
      }).toThrow()
    })
  })

  describe('getRelatedTags', () => {
    it('should return tags that co-occur with given tag', () => {
      const tag1 = tagRepo.create({ name: 'tag1', color: '#ff0000' })
      const tag2 = tagRepo.create({ name: 'tag2', color: '#00ff00' })
      const tag3 = tagRepo.create({ name: 'tag3', color: '#0000ff' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test' })
      const note2 = noteRepo.create({ title: 'Note 2', content: 'Test' })

      // tag1 and tag2 appear together in both notes
      tagRepo.addToNote(note1.id, tag1.id)
      tagRepo.addToNote(note1.id, tag2.id)
      tagRepo.addToNote(note2.id, tag1.id)
      tagRepo.addToNote(note2.id, tag2.id)

      // tag3 only in note1 with tag1
      tagRepo.addToNote(note1.id, tag3.id)

      const related = tagRepo.getRelatedTags(tag1.id)

      expect(related.length).toBeGreaterThan(0)
      const tag2Related = related.find(t => t.id === tag2.id)
      const tag3Related = related.find(t => t.id === tag3.id)

      expect(tag2Related?.note_count).toBe(2)
      expect(tag3Related?.note_count).toBe(1)
    })

    it('should not include the tag itself', () => {
      const tag = tagRepo.create({ name: 'tag', color: '#ff0000' })
      const note = noteRepo.create({ title: 'Note', content: 'Test' })

      tagRepo.addToNote(note.id, tag.id)

      const related = tagRepo.getRelatedTags(tag.id)
      expect(related.map(t => t.id)).not.toContain(tag.id)
    })
  })
})
