import type {
  ICheckDatabaseIntegrityUseCase,
  DatabaseIntegrityResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { IDatabaseManager } from '../../../domain/ports/out/IDatabaseManager';

export class CheckDatabaseIntegrityUseCase implements ICheckDatabaseIntegrityUseCase {
  constructor(private readonly getDatabaseManager: () => IDatabaseManager) {}

  async execute(): Promise<DatabaseIntegrityResponse> {
    const db = this.getDatabaseManager();
    const result = await db.checkIntegrity();
    return result;
  }
}
