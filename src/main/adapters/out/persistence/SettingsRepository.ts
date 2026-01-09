/**
 * Settings Repository Adapter
 *
 * Implements ISettingsRepository port using SQLite via Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { settings, type Database } from '../../../shared';
import type { ISettingsRepository, SettingProps } from '../../../domain';

export interface SettingsRepositoryDeps {
  db: Database;
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly deps: SettingsRepositoryDeps) {}

  async get(key: string): Promise<SettingProps | null> {
    const result = await this.deps.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    return result[0] ? this.toSettingProps(result[0]) : null;
  }

  async set(key: string, value: string): Promise<SettingProps> {
    const now = new Date();
    const existing = await this.get(key);

    if (existing) {
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
  }

  async getAll(): Promise<SettingProps[]> {
    const result = await this.deps.db.select().from(settings);
    return result.map((row) => this.toSettingProps(row));
  }

  async delete(key: string): Promise<void> {
    await this.deps.db.delete(settings).where(eq(settings.key, key));
  }

  private toSettingProps(row: typeof settings.$inferSelect): SettingProps {
    return {
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt,
    };
  }
}
