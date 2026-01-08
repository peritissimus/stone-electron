/**
 * Database Module Exports
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from './schema';

/**
 * Database type used throughout the application.
 * This provides a single source of truth for the Drizzle database type.
 */
export type Database = LibSQLDatabase<typeof schema>;

export { DatabaseManager, getDatabaseManager } from './DatabaseManager';
export * from './schema';
