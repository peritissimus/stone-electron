/**
 * Database Use Cases - Database management operations
 */

import type { IDatabaseUseCases } from '../../../domain/ports/in/IDatabaseUseCases';
import { logger } from '../../../shared/utils';

export interface DatabaseUseCasesDeps {
  getDatabaseManager: () => {
    getStatus: () => Promise<{ path: string; size: number; isOpen: boolean }>;
    vacuum: () => Promise<void>;
    checkIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
  };
}

class DatabaseUseCasesImpl implements IDatabaseUseCases {
  constructor(private deps: DatabaseUseCasesDeps) {}

  async getStatus(): Promise<{ path: string; size: number; isOpen: boolean }> {
    const db = this.deps.getDatabaseManager();
    return db.getStatus();
  }

  async vacuum(): Promise<void> {
    const db = this.deps.getDatabaseManager();
    await db.vacuum();
    logger.info('[DatabaseUseCases] Database vacuumed');
  }

  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    const db = this.deps.getDatabaseManager();
    const result = await db.checkIntegrity();
    logger.info(`[DatabaseUseCases] Integrity check: ${result.ok ? 'OK' : 'ERRORS'}`);
    return result;
  }
}

export function createDatabaseUseCases(deps: DatabaseUseCasesDeps): IDatabaseUseCases {
  return new DatabaseUseCasesImpl(deps);
}
