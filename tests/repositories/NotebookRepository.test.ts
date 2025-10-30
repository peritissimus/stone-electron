/**
 * NotebookRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { NotebookRepository } from '@main/repositories/NotebookRepository'
import { NoteRepository } from '@main/repositories/NoteRepository'
import { createTestDatabase, cleanupTestDatabase } from '../helpers/testDatabase'

describe('NotebookRepository', () => {
  let db: Database.Database
  let notebookRepo: NotebookRepository
  let noteRepo: NoteRepository

  beforeEach(() => {
    db = createTestDatabase()
    notebookRepo = new NotebookRepository(db)
    noteRepo = new NoteRepository(db)
  })

  afterEach(() => {
    cleanupTestDatabase(db)
  })

  describe('create', () => {
    it('should create a notebook with default values', () => {
      const notebook = notebookRepo.create({ name: 'Work' })

      expect(notebook).toBeDefined()
      expect(notebook.id).toBeDefined()
      expect(notebook.name).toBe('Work')
      expect(notebook.icon).toBe('📓')
      expect(notebook.color).toBe('#3B82F6')
      expect(notebook.parent_id).toBeNull()
      expect(notebook.position).toBe(0)
    })

    it('should create a notebook with custom properties', () => {
      const notebook = notebookRepo.create({
        name: 'Projects',
        icon: '🚀',
        color: '#ff0000',
        position: 5,
      })

      expect(notebook.icon).toBe('🚀')
      expect(notebook.color).toBe('#ff0000')
      expect(notebook.position).toBe(5)
    })
  })

  describe('getRoots', () => {
    it('should return only root notebooks', () => {
      const root1 = notebookRepo.create({ name: 'Root 1' })
      const root2 = notebookRepo.create({ name: 'Root 2' })
      notebookRepo.create({ name: 'Child', parent_id: root1.id })

      const roots = notebookRepo.getRoots()
      expect(roots).toHaveLength(2)
      expect(roots.map(n => n.name)).toContain('Root 1')
      expect(roots.map(n => n.name)).toContain('Root 2')
    })

    it('should order roots by position', () => {
      notebookRepo.create({ name: 'Third', position: 2 })
      notebookRepo.create({ name: 'First', position: 0 })
      notebookRepo.create({ name: 'Second', position: 1 })

      const roots = notebookRepo.getRoots()
      expect(roots[0].name).toBe('First')
      expect(roots[1].name).toBe('Second')
      expect(roots[2].name).toBe('Third')
    })
  })

  describe('getChildren', () => {
    it('should return children of a notebook', () => {
      const parent = notebookRepo.create({ name: 'Parent' })
      notebookRepo.create({ name: 'Child 1', parent_id: parent.id })
      notebookRepo.create({ name: 'Child 2', parent_id: parent.id })
      notebookRepo.create({ name: 'Other' })

      const children = notebookRepo.getChildren(parent.id)
      expect(children).toHaveLength(2)
    })
  })

  describe('getTree', () => {
    it('should build hierarchical tree', () => {
      const root = notebookRepo.create({ name: 'Root' })
      const child1 = notebookRepo.create({ name: 'Child 1', parent_id: root.id })
      notebookRepo.create({ name: 'Grandchild', parent_id: child1.id })

      const tree = notebookRepo.getTree()
      expect(tree).toHaveLength(1)
      expect(tree[0].name).toBe('Root')
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children![0].name).toBe('Child 1')
      expect(tree[0].children![0].children).toHaveLength(1)
      expect(tree[0].children![0].children![0].name).toBe('Grandchild')
    })
  })

  describe('getNoteCount', () => {
    it('should count notes in a notebook', () => {
      const notebook = notebookRepo.create({ name: 'Work' })

      noteRepo.create({ title: 'Note 1', content: 'Test', notebook_id: notebook.id })
      noteRepo.create({ title: 'Note 2', content: 'Test', notebook_id: notebook.id })

      const count = notebookRepo.getNoteCount(notebook.id)
      expect(count).toBe(2)
    })

    it('should not count deleted notes', () => {
      const notebook = notebookRepo.create({ name: 'Work' })

      const note1 = noteRepo.create({ title: 'Note 1', content: 'Test', notebook_id: notebook.id })
      noteRepo.create({ title: 'Note 2', content: 'Test', notebook_id: notebook.id })
      noteRepo.softDelete(note1.id)

      const count = notebookRepo.getNoteCount(notebook.id)
      expect(count).toBe(1)
    })

    it('should count notes in sub-notebooks when includeSubNotebooks is true', () => {
      const parent = notebookRepo.create({ name: 'Parent' })
      const child = notebookRepo.create({ name: 'Child', parent_id: parent.id })

      noteRepo.create({ title: 'Parent Note', content: 'Test', notebook_id: parent.id })
      noteRepo.create({ title: 'Child Note', content: 'Test', notebook_id: child.id })

      const count = notebookRepo.getNoteCount(parent.id, true)
      expect(count).toBe(2)
    })
  })

  describe('move', () => {
    it('should move a notebook to new parent', () => {
      const parent1 = notebookRepo.create({ name: 'Parent 1' })
      const parent2 = notebookRepo.create({ name: 'Parent 2' })
      const child = notebookRepo.create({ name: 'Child', parent_id: parent1.id })

      const moved = notebookRepo.move(child.id, parent2.id)
      expect(moved.parent_id).toBe(parent2.id)
    })

    it('should prevent moving notebook into itself', () => {
      const notebook = notebookRepo.create({ name: 'Test' })

      expect(() => {
        notebookRepo.move(notebook.id, notebook.id)
      }).toThrow()
    })

    it('should prevent moving notebook into its descendants', () => {
      const parent = notebookRepo.create({ name: 'Parent' })
      const child = notebookRepo.create({ name: 'Child', parent_id: parent.id })

      expect(() => {
        notebookRepo.move(parent.id, child.id)
      }).toThrow()
    })

    it('should move notebook to root level', () => {
      const parent = notebookRepo.create({ name: 'Parent' })
      const child = notebookRepo.create({ name: 'Child', parent_id: parent.id })

      const moved = notebookRepo.move(child.id, null)
      expect(moved.parent_id).toBeNull()
    })
  })

  describe('getBreadcrumb', () => {
    it('should return breadcrumb path', () => {
      const root = notebookRepo.create({ name: 'Root' })
      const child = notebookRepo.create({ name: 'Child', parent_id: root.id })
      const grandchild = notebookRepo.create({ name: 'Grandchild', parent_id: child.id })

      const breadcrumb = notebookRepo.getBreadcrumb(grandchild.id)
      expect(breadcrumb).toHaveLength(3)
      expect(breadcrumb[0].name).toBe('Root')
      expect(breadcrumb[1].name).toBe('Child')
      expect(breadcrumb[2].name).toBe('Grandchild')
    })
  })

  describe('getAncestors', () => {
    it('should return all ancestors excluding the notebook itself', () => {
      const root = notebookRepo.create({ name: 'Root' })
      const child = notebookRepo.create({ name: 'Child', parent_id: root.id })
      const grandchild = notebookRepo.create({ name: 'Grandchild', parent_id: child.id })

      const ancestors = notebookRepo.getAncestors(grandchild.id)
      expect(ancestors).toHaveLength(2)
      expect(ancestors[0].name).toBe('Root')
      expect(ancestors[1].name).toBe('Child')
    })
  })

  describe('reorder', () => {
    it('should reorder notebooks', () => {
      const nb1 = notebookRepo.create({ name: 'First', position: 0 })
      const nb2 = notebookRepo.create({ name: 'Second', position: 1 })
      const nb3 = notebookRepo.create({ name: 'Third', position: 2 })

      // Reverse order
      notebookRepo.reorder([nb3.id, nb2.id, nb1.id], null)

      const reordered = notebookRepo.getRoots()
      expect(reordered[0].name).toBe('Third')
      expect(reordered[1].name).toBe('Second')
      expect(reordered[2].name).toBe('First')
    })
  })

  describe('deleteWithNotes', () => {
    it('should delete notebook and soft-delete notes when action is delete', () => {
      const notebook = notebookRepo.create({ name: 'Delete Me' })
      const note = noteRepo.create({ title: 'Note', content: 'Test', notebook_id: notebook.id })

      notebookRepo.deleteWithNotes(notebook.id, 'delete')

      expect(notebookRepo.findById(notebook.id)).toBeNull()
      const deletedNote = noteRepo.findById(note.id)
      expect(deletedNote?.is_deleted).toBe(1)
    })

    it('should orphan notes when action is orphan', () => {
      const notebook = notebookRepo.create({ name: 'Orphan Me' })
      const note = noteRepo.create({ title: 'Note', content: 'Test', notebook_id: notebook.id })

      notebookRepo.deleteWithNotes(notebook.id, 'orphan')

      expect(notebookRepo.findById(notebook.id)).toBeNull()
      const orphanedNote = noteRepo.findById(note.id)
      expect(orphanedNote?.notebook_id).toBeNull()
      expect(orphanedNote?.is_deleted).toBe(0)
    })

    it('should move notes when action is move', () => {
      const notebook1 = notebookRepo.create({ name: 'Notebook 1' })
      const notebook2 = notebookRepo.create({ name: 'Notebook 2' })
      const note = noteRepo.create({ title: 'Note', content: 'Test', notebook_id: notebook1.id })

      notebookRepo.deleteWithNotes(notebook1.id, 'move', notebook2.id)

      expect(notebookRepo.findById(notebook1.id)).toBeNull()
      const movedNote = noteRepo.findById(note.id)
      expect(movedNote?.notebook_id).toBe(notebook2.id)
    })
  })

  describe('searchByName', () => {
    it('should find notebooks by partial name match', () => {
      notebookRepo.create({ name: 'Work Projects' })
      notebookRepo.create({ name: 'Personal Projects' })
      notebookRepo.create({ name: 'Home' })

      const results = notebookRepo.searchByName('Project')
      expect(results).toHaveLength(2)
      expect(results.every(n => n.name.includes('Project'))).toBe(true)
    })

    it('should be case insensitive', () => {
      notebookRepo.create({ name: 'Work' })

      const results = notebookRepo.searchByName('work')
      expect(results).toHaveLength(1)
    })
  })

  describe('getFlatList', () => {
    it('should return all notebooks in flat list', () => {
      const parent = notebookRepo.create({ name: 'Parent' })
      notebookRepo.create({ name: 'Child', parent_id: parent.id })
      notebookRepo.create({ name: 'Another Root' })

      const list = notebookRepo.getFlatList()
      expect(list).toHaveLength(3)
    })

    it('should sort by name', () => {
      notebookRepo.create({ name: 'Zebra' })
      notebookRepo.create({ name: 'Apple' })
      notebookRepo.create({ name: 'Banana' })

      const list = notebookRepo.getFlatList()
      expect(list[0].name).toBe('Apple')
      expect(list[1].name).toBe('Banana')
      expect(list[2].name).toBe('Zebra')
    })
  })
})
