import type {
  IVacuumDatabaseUseCase,
  VacuumDatabaseResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { IDatabaseManager } from '../../../domain/ports/out/IDatabaseManager';

export class VacuumDatabaseUseCase implements IVacuumDatabaseUseCase {
  constructor(private readonly getDatabaseManager: () => IDatabaseManager) {}

  async execute(): Promise<VacuumDatabaseResponse> {
    const db = this.getDatabaseManager();

    const before = await db.getStatus();
    await db.vacuum();
    const after = await db.getStatus();

    const freed = Math.max(0, before.size - after.size);

    return {
      size_before: before.size,
      size_after: after.size,
      freed_bytes: freed,
    };
  }
}
