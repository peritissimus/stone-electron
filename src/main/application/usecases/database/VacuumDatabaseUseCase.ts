import type {
  IVacuumDatabaseUseCase,
  VacuumDatabaseResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';
import { logger } from '../../../shared/utils';

export class VacuumDatabaseUseCase implements IVacuumDatabaseUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<VacuumDatabaseResponse> {
    const db = this.getDatabaseManager();

    const before = await db.getStatus();
    await db.vacuum();
    const after = await db.getStatus();

    const freed = Math.max(0, before.size - after.size);
    logger.info(
      `[DatabaseUseCases] Database vacuumed (${before.size} → ${after.size} bytes, freed ${freed})`,
    );

    return {
      size_before: before.size,
      size_after: after.size,
      freed_bytes: freed,
    };
  }
}
