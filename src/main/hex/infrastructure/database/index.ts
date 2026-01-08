/**
 * Database Module Exports
 *
 * Re-exports database types and schema from shared module.
 * Provides DatabaseManager for this infrastructure layer.
 */

// Re-export shared database types and schema
export * from '../../shared/database';
export type { Database } from '../../shared/database';

// Export infrastructure-specific DatabaseManager
export { DatabaseManager, getDatabaseManager } from './DatabaseManager';
