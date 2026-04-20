import type { DatabaseStatusResponse } from '../../../domain/ports/in/IDatabaseUseCases';

export interface DatabaseManager {
  getStatus(): Promise<DatabaseStatusResponse>;
  vacuum(): Promise<void>;
  checkIntegrity(): Promise<{ ok: boolean; errors: string[] }>;
}
