/**
 * BaseRepository - Abstract base class for all repositories
 * Provides common CRUD operations and transaction support
 */

import Database from 'better-sqlite3'
import { generateId } from '@shared/utils/id'

export interface QueryOptions {
  where?: Record<string, unknown>
  sort?: {
    field: string
    order: 'ASC' | 'DESC'
  }
  limit?: number
  offset?: number
}

/**
 * Base Repository - Generic CRUD operations
 */
export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected db: Database.Database
  protected abstract tableName: string

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Find a record by ID
   */
  findById(id: string): T | null {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
    const result = stmt.get(id) as T | undefined
    return result || null
  }

  /**
   * Find all records with optional filtering and sorting
   */
  findAll(options?: QueryOptions): T[] {
    let query = `SELECT * FROM ${this.tableName}`
    const params: unknown[] = []

    // Add WHERE clause
    if (options?.where) {
      const whereClause = this.buildWhereClause(options.where, params)
      if (whereClause) {
        query += ` WHERE ${whereClause}`
      }
    }

    // Add ORDER BY
    if (options?.sort) {
      query += ` ORDER BY ${options.sort.field} ${options.sort.order}`
    }

    // Add LIMIT
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`
    }

    // Add OFFSET
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`
    }

    const stmt = this.db.prepare(query)
    return stmt.all(...params) as T[]
  }

  /**
   * Create a new record
   */
  create(data: Partial<T>): T {
    const id = generateId()
    const now = Math.floor(Date.now() / 1000)

    const fields = Object.keys(data)
    const placeholders = fields.map(() => '?').join(',')
    const values = Object.values(data)

    const query = `
      INSERT INTO ${this.tableName}
      (id, ${fields.join(',')}, created_at, updated_at)
      VALUES (?, ${placeholders}, ?, ?)
    `

    const stmt = this.db.prepare(query)
    stmt.run(id, ...values, now, now)

    return this.findById(id)!
  }

  /**
   * Update a record by ID
   */
  update(id: string, data: Partial<T>): T {
    const now = Math.floor(Date.now() / 1000)

    const fields = Object.keys(data)
    const updates = fields.map((key) => `${key} = ?`).join(',')
    const values = Object.values(data)

    const query = `
      UPDATE ${this.tableName}
      SET ${updates}, updated_at = ?
      WHERE id = ?
    `

    const stmt = this.db.prepare(query)
    stmt.run(...values, now, id)

    return this.findById(id)!
  }

  /**
   * Delete a record by ID
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
    const result = stmt.run(id)
    return (result.changes || 0) > 0
  }

  /**
   * Count records with optional filtering
   */
  count(where?: Record<string, unknown>): number {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`
    const params: unknown[] = []

    if (where) {
      const whereClause = this.buildWhereClause(where, params)
      if (whereClause) {
        query += ` WHERE ${whereClause}`
      }
    }

    const stmt = this.db.prepare(query)
    const result = stmt.get(...params) as { count: number }
    return result.count
  }

  /**
   * Execute a transaction
   */
  transaction<R>(callback: () => R): R {
    const transaction = this.db.transaction(callback)
    return transaction()
  }

  /**
   * Batch create multiple records
   */
  batchCreate(items: Array<Partial<T>>): T[] {
    return this.transaction(() => {
      return items.map((item) => this.create(item))
    })
  }

  /**
   * Batch update multiple records
   */
  batchUpdate(updates: Array<{ id: string; data: Partial<T> }>): void {
    this.transaction(() => {
      for (const { id, data } of updates) {
        this.update(id, data)
      }
    })
  }

  /**
   * Build WHERE clause from object
   */
  protected buildWhereClause(where: Record<string, unknown>, params: unknown[]): string {
    const conditions = Object.entries(where)
      .map(([key, value]) => {
        params.push(value)
        return `${key} = ?`
      })
      .filter(Boolean)

    return conditions.join(' AND ')
  }

  /**
   * Check if a record exists
   */
  exists(id: string): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`)
    const result = stmt.get(id)
    return !!result
  }

  /**
   * Get the first record matching conditions
   */
  findOne(where: Record<string, unknown>): T | null {
    const results = this.findAll({ where, limit: 1 })
    return results.length > 0 ? results[0] : null
  }
}
