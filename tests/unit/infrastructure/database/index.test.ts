import { describe, expect, it } from 'vitest';
import * as databaseModule from '../../../../src/main/infrastructure/database';

describe('infrastructure database index', () => {
  it('re-exports database schema and manager helpers', () => {
    expect(databaseModule.DatabaseManager).toBeTypeOf('function');
    expect(databaseModule.getDatabaseManager).toBeTypeOf('function');
    expect(databaseModule.notes).toBeTruthy();
    expect(databaseModule.workspaces).toBeTruthy();
  });
});
