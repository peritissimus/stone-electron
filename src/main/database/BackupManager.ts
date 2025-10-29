/**
 * BackupManager - Handles database backups and restoration
 */

import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

export interface BackupInfo {
  id: string
  timestamp: number
  name: string
  size: number
  path: string
}

/**
 * Backup Manager
 */
export class BackupManager {
  private backupsDir: string
  private dbPath: string
  private readonly MAX_BACKUPS = 5

  constructor(dataPath: string) {
    this.backupsDir = path.join(dataPath, 'backups')
    this.dbPath = path.join(dataPath, 'notes.db')

    // Ensure backups directory exists
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true })
    }
  }

  /**
   * Create a backup
   */
  async createBackup(label: string = 'manual'): Promise<BackupInfo> {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const dateStr = new Date(timestamp * 1000).toISOString().split('T')[0]
      const backupId = `${dateStr}_${timestamp}_${label}`
      const backupPath = path.join(this.backupsDir, backupId)

      // Create backup directory
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true })
      }

      // Copy database file
      const dbBackupPath = path.join(backupPath, 'notes.db')
      fs.copyFileSync(this.dbPath, dbBackupPath)

      // Create manifest
      const stats = fs.statSync(this.dbPath)
      const manifest = {
        version: '1.0',
        timestamp,
        backupId,
        label,
        database_size: stats.size,
        created_at: new Date().toISOString(),
      }

      fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2))

      const backupSize = stats.size

      console.log(`✓ Backup created: ${backupId} (${this.formatSize(backupSize)})`)

      return {
        id: backupId,
        timestamp,
        name: label,
        size: backupSize,
        path: backupPath,
      }
    } catch (error) {
      console.error('Backup creation failed:', error)
      throw new Error('Failed to create backup')
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupInfo[] {
    if (!fs.existsSync(this.backupsDir)) {
      return []
    }

    const backups = fs
      .readdirSync(this.backupsDir)
      .filter((f) => fs.statSync(path.join(this.backupsDir, f)).isDirectory())
      .map((backupId) => {
        const backupPath = path.join(this.backupsDir, backupId)
        const manifestPath = path.join(backupPath, 'manifest.json')

        if (!fs.existsSync(manifestPath)) {
          return null
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        const dbPath = path.join(backupPath, 'notes.db')
        const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0

        return {
          id: backupId,
          timestamp: manifest.timestamp,
          name: manifest.label || 'backup',
          size,
          path: backupPath,
        }
      })
      .filter((b): b is BackupInfo => b !== null)
      .sort((a, b) => b.timestamp - a.timestamp)

    return backups
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    try {
      const backupPath = path.join(this.backupsDir, backupId)
      const dbBackupPath = path.join(backupPath, 'notes.db')

      if (!fs.existsSync(dbBackupPath)) {
        throw new Error(`Backup database not found: ${backupId}`)
      }

      // Create a temporary backup of current database before restore
      const tempBackupPath = this.dbPath + '.pre-restore'
      fs.copyFileSync(this.dbPath, tempBackupPath)

      try {
        // Restore the backup
        fs.copyFileSync(dbBackupPath, this.dbPath)
        console.log(`✓ Database restored from backup: ${backupId}`)

        // Remove temporary backup after successful restore
        fs.unlinkSync(tempBackupPath)
      } catch (error) {
        // Restore the pre-restore backup if something went wrong
        fs.copyFileSync(tempBackupPath, this.dbPath)
        fs.unlinkSync(tempBackupPath)
        throw error
      }
    } catch (error) {
      console.error('Backup restore failed:', error)
      throw new Error('Failed to restore backup')
    }
  }

  /**
   * Clean old backups (keep only MAX_BACKUPS)
   */
  cleanOldBackups(): void {
    const backups = this.listBackups()

    if (backups.length > this.MAX_BACKUPS) {
      const toDelete = backups.slice(this.MAX_BACKUPS)

      for (const backup of toDelete) {
        try {
          this.deleteBackup(backup.id)
        } catch (error) {
          console.error(`Failed to delete old backup ${backup.id}:`, error)
        }
      }
    }
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): void {
    const backupPath = path.join(this.backupsDir, backupId)

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true })
      console.log(`✓ Backup deleted: ${backupId}`)
    }
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'

    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Get total backup size
   */
  getTotalBackupSize(): number {
    const backups = this.listBackups()
    return backups.reduce((total, backup) => total + backup.size, 0)
  }
}
