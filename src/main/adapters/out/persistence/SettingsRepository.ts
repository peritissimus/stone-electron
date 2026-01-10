/**
 * Settings Repository Adapter
 *
 * Implements ISettingsRepository port using SQLite via Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { settings, type Database } from '../../../shared';
import type { ISettingsRepository, SettingProps } from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface SettingsRepositoryDeps {
  db: Database;
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly deps: SettingsRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'SettingsRepository', operation, context });
  }

  async get(key: string): Promise<SettingProps | null> {
    return this.handle(
      'get',
      async () => {
        const result = await this.deps.db
          .select()
          .from(settings)
          .where(eq(settings.key, key))
          .limit(1);

        return result[0] ? this.toSettingProps(result[0]) : null;
      },
      { key },
    );
  }

  async set(key: string, value: string): Promise<SettingProps> {
    return this.handle(
      'set',
      async () => {
        const now = new Date();
        const existing = await this.deps.db
          .select({ key: settings.key })
          .from(settings)
          .where(eq(settings.key, key))
          .limit(1);

        if (existing.length > 0) {
          await this.deps.db
            .update(settings)
            .set({
              value,
              updatedAt: now,
            })
            .where(eq(settings.key, key));
        } else {
          await this.deps.db.insert(settings).values({
            key,
            value,
            updatedAt: now,
          });
        }

        return {
          key,
          value,
          updatedAt: now,
        };
      },
      { key },
    );
  }

  async getAll(): Promise<SettingProps[]> {
    return this.handle('getAll', async () => {
      const result = await this.deps.db.select().from(settings);
      return result.map((row) => this.toSettingProps(row));
    });
  }

  async delete(key: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(settings).where(eq(settings.key, key));
      },
      { key },
    );
  }

  private toSettingProps(row: typeof settings.$inferSelect): SettingProps {
    return {
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt,
    };
  }
}
