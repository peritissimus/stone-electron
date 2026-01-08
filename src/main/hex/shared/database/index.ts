/**
 * Shared Database Module
 *
 * Exports database schema and types for use across hex layers.
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Re-export all schema tables and types
export * from './schema';

// Database type with full schema typing
export type Database = LibSQLDatabase<typeof schema>;
