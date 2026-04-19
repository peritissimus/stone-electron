import type {
  IGetDatabaseStatusUseCase,
  DatabaseStatusResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';

export interface DatabaseManager {
  getStatus(): Promise<DatabaseStatusResponse>;
  vacuum(): Promise<void>;
  checkIntegrity(): Promise<{ ok: boolean; errors: string[] }>;
}

export class GetDatabaseStatusUseCase implements IGetDatabaseStatusUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<DatabaseStatusResponse> {
    const db = this.getDatabaseManager();
    return db.getStatus();
  }
}
