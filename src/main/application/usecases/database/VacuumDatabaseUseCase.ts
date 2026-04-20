import type { IVacuumDatabaseUseCase } from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';
import { logger } from '../../../shared/utils';

export class VacuumDatabaseUseCase implements IVacuumDatabaseUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<void> {
    const db = this.getDatabaseManager();
    await db.vacuum();
    logger.info('[DatabaseUseCases] Database vacuumed');
  }
}
