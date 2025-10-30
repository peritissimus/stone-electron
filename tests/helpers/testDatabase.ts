/**
 * Test Database Helpers
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

/**
 * Create a test database with the schema
 */
export function createTestDatabase(): Database.Database {
  const testDbPath = path.join(process.cwd(), 'tests', 'tmp', `test-${nanoid()}.db`);

  const db = new Database(testDbPath);
  db.pragma('foreign_keys = ON');

  // Read and execute the migration file
  const migrationPath = path.join(process.cwd(), 'migrations', '0000_omniscient_lyja.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  // Execute the migration SQL
  db.exec(migrationSQL);

  return db;
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name;
  db.close();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}
