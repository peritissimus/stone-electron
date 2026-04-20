import type {
  ICheckDatabaseIntegrityUseCase,
  DatabaseIntegrityResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';
import { logger } from '../../../shared/utils';

export class CheckDatabaseIntegrityUseCase implements ICheckDatabaseIntegrityUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<DatabaseIntegrityResponse> {
    const db = this.getDatabaseManager();
    const result = await db.checkIntegrity();
    logger.info(`[DatabaseUseCases] Integrity check: ${result.ok ? 'OK' : 'ERRORS'}`);
    return result;
  }
}
