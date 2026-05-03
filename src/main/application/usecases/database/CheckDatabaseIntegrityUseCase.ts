import type {
  ICheckDatabaseIntegrityUseCase,
  DatabaseIntegrityResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';

export class CheckDatabaseIntegrityUseCase implements ICheckDatabaseIntegrityUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<DatabaseIntegrityResponse> {
    const db = this.getDatabaseManager();
    const result = await db.checkIntegrity();
    return result;
  }
}
