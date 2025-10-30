/**
 * NotebookRepository - Handles notebook hierarchy and organization
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import type { Notebook } from '@shared/types'

interface NotebookWithChildren extends Notebook {
  children?: NotebookWithChildren[]
  note_count?: number
}

/**
 * Notebook Repository
 */
export class NotebookRepository extends BaseRepository<Notebook> {
  protected tableName = 'notebooks'

  /**
   * Get all root notebooks (no parent)
   */
  getRoots(): Notebook[] {
    return this.findAll({
      where: { parentId: null },
      sort: { field: 'position', order: 'ASC' },
    })
  }

  /**
   * Get children of a notebook
   */
  getChildren(parentId: string): Notebook[] {
    return this.findAll({
      where: { parentId: parentId },
      sort: { field: 'position', order: 'ASC' },
    })
  }

  /**
   * Get complete hierarchy tree
   */
  getTree(): NotebookWithChildren[] {
    const roots = this.getRoots()
    return roots.map((root) => this.buildTree(root))
  }

  /**
   * Build tree recursively
   */
  private buildTree(notebook: Notebook): NotebookWithChildren {
    const children = this.getChildren(notebook.id)
    const noteCount = this.getNoteCount(notebook.id)

    return {
      ...notebook,
      note_count: noteCount,
      children: children.map((child) => this.buildTree(child)),
    }
  }

  /**
   * Get note count for a notebook (including sub-notebooks)
   */
  getNoteCount(notebookId: string, includeSubNotebooks: boolean = false): number {
    if (!includeSubNotebooks) {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM notes
        WHERE notebookId = ? AND is_deleted = 0
      `)
      const result = stmt.get(notebookId) as { count: number }
      return result.count
    }

    // Get all notebook IDs in the hierarchy
    const notebookIds = this.getAllDescendantIds(notebookId)
    notebookIds.push(notebookId)

    const placeholders = notebookIds.map(() => '?').join(',')
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM notes
      WHERE notebookId IN (${placeholders}) AND is_deleted = 0
    `)

    const result = stmt.get(...notebookIds) as { count: number }
    return result.count
  }

  /**
   * Get all descendant notebook IDs
   */
  private getAllDescendantIds(notebookId: string): string[] {
    const children = this.getChildren(notebookId)
    const ids: string[] = []

    for (const child of children) {
      ids.push(child.id)
      ids.push(...this.getAllDescendantIds(child.id))
    }

    return ids
  }

  /**
   * Move a notebook to a new parent
   */
  move(notebookId: string, newParentId: string | null, newPosition?: number): Notebook {
    // Prevent moving a notebook into itself or its descendants
    if (newParentId) {
      const descendants = this.getAllDescendantIds(notebookId)
      if (descendants.includes(newParentId) || notebookId === newParentId) {
        throw new Error('Cannot move notebook into itself or its descendants')
      }
    }

    const updateData: Partial<Notebook> = {
      parentId: newParentId,
    } as Partial<Notebook>

    if (newPosition !== undefined) {
      updateData.position = newPosition
    }

    return this.update(notebookId, updateData)
  }

  /**
   * Get the breadcrumb path for a notebook
   */
  getBreadcrumb(notebookId: string): Notebook[] {
    const path: Notebook[] = []
    let currentId: string | null = notebookId

    while (currentId) {
      const notebook = this.findById(currentId)
      if (!notebook) break

      path.unshift(notebook)
      currentId = notebook.parentId
    }

    return path
  }

  /**
   * Get all ancestors of a notebook
   */
  getAncestors(notebookId: string): Notebook[] {
    const breadcrumb = this.getBreadcrumb(notebookId)
    // Remove the notebook itself (last element)
    return breadcrumb.slice(0, -1)
  }

  /**
   * Reorder notebooks within the same parent
   */
  reorder(notebookIds: string[], parentId: string | null): void {
    this.transaction(() => {
      notebookIds.forEach((id, index) => {
        this.update(id, {
          position: index,
          parentId: parentId,
        } as Partial<Notebook>)
      })
    })
  }

  /**
   * Delete notebook and optionally move notes
   */
  deleteWithNotes(
    notebookId: string,
    action: 'delete' | 'orphan' | 'move',
    targetNotebookId?: string
  ): void {
    this.transaction(() => {
      if (action === 'delete') {
        // Delete all notes in this notebook and descendants
        const allIds = [notebookId, ...this.getAllDescendantIds(notebookId)]
        const placeholders = allIds.map(() => '?').join(',')

        this.db.prepare(`
          UPDATE notes
          SET is_deleted = 1, deleted_at = strftime('%s', 'now')
          WHERE notebookId IN (${placeholders})
        `).run(...allIds)
      } else if (action === 'orphan') {
        // Set notes' notebookId to NULL
        this.db.prepare(`
          UPDATE notes
          SET notebookId = NULL
          WHERE notebookId = ?
        `).run(notebookId)
      } else if (action === 'move' && targetNotebookId) {
        // Move notes to target notebook
        this.db.prepare(`
          UPDATE notes
          SET notebookId = ?
          WHERE notebookId = ?
        `).run(targetNotebookId, notebookId)
      }

      // Delete the notebook (CASCADE will handle children)
      this.delete(notebookId)
    })
  }

  /**
   * Find notebooks by name (search)
   */
  searchByName(query: string): Notebook[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notebooks
      WHERE name LIKE ?
      ORDER BY name ASC
    `)
    return stmt.all(`%${query}%`) as Notebook[]
  }

  /**
   * Get flat list of all notebooks
   */
  getFlatList(): Notebook[] {
    return this.findAll({
      sort: { field: 'name', order: 'ASC' },
    })
  }
}
