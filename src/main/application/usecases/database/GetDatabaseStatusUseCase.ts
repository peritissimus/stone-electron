import type {
  IGetDatabaseStatusUseCase,
  DatabaseStatusResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';

export class GetDatabaseStatusUseCase implements IGetDatabaseStatusUseCase {
  constructor(private readonly getDatabaseManager: () => DatabaseManager) {}

  async execute(): Promise<DatabaseStatusResponse> {
    const db = this.getDatabaseManager();
    return db.getStatus();
  }
}
