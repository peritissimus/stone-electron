/**
 * DatabaseManager - Core database connection and lifecycle management (libsql)
 *
 * Clean version for hexagonal architecture - sync logic handled by use cases.
 */

import { createClient } from '@libsql/client/sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Conditionally import electron
let app: any = null;
try {
  const electron = require('electron');
  if (typeof electron !== 'string' && electron.app) {
    app = electron.app;
  } else {
    throw new Error('Not running in Electron context');
  }
} catch {
  app = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(os.homedir(), '.stone');
      }
      return os.tmpdir();
    },
    isPackaged: false,
  };
}

import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../../shared/database';
import { logger } from '../../shared/utils';
import { seedDatabase } from '../seed/seedDatabase';
import { AppConfigRepository } from '../../adapters/out/persistence/AppConfigRepository';
import { DEFAULT_APP_CONFIG, type AppConfig } from '@shared/types/settings';

async function readLegacyAppearanceConfig(db: ReturnType<typeof drizzle>): Promise<Partial<AppConfig> | null> {
  const [themeSetting, accentColorSetting, fontSettingsSetting] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.key, 'appearance.theme')).limit(1),
    db.select().from(schema.settings).where(eq(schema.settings.key, 'appearance.accentColor')).limit(1),
    db.select().from(schema.settings).where(eq(schema.settings.key, 'appearance.fontSettings')).limit(1),
  ]);

  const hasLegacySettings =
    themeSetting.length > 0 || accentColorSetting.length > 0 || fontSettingsSetting.length > 0;

  if (!hasLegacySettings) {
    return null;
  }

  let parsedFontSettings: unknown;
  if (fontSettingsSetting[0]?.value) {
    try {
      parsedFontSettings = JSON.parse(fontSettingsSetting[0].value);
    } catch {
      parsedFontSettings = undefined;
    }
  }

  return {
    appearance: {
      theme:
        themeSetting[0]?.value === 'light' ||
        themeSetting[0]?.value === 'dark' ||
        themeSetting[0]?.value === 'system'
          ? themeSetting[0].value
          : DEFAULT_APP_CONFIG.appearance.theme,
      accentColor:
        accentColorSetting[0]?.value === 'blue' ||
        accentColorSetting[0]?.value === 'purple' ||
        accentColorSetting[0]?.value === 'pink' ||
        accentColorSetting[0]?.value === 'red' ||
        accentColorSetting[0]?.value === 'orange' ||
        accentColorSetting[0]?.value === 'green' ||
        accentColorSetting[0]?.value === 'teal'
          ? accentColorSetting[0].value
          : DEFAULT_APP_CONFIG.appearance.accentColor,
      fontSettings: {
        ...DEFAULT_APP_CONFIG.appearance.fontSettings,
        ...(typeof parsedFontSettings === 'object' && parsedFontSettings !== null ? parsedFontSettings : {}),
      },
    },
  };
}

export class DatabaseManager {
  private client: any = null;
  private db: any = null;
  private initPromise: Promise<void> | null = null;
  private readonly dataPath: string;
  private readonly dbPath: string;

  constructor() {
    const dbUrl = app.isPackaged ? undefined : process.env.DATABASE_URL;

    if (dbUrl) {
      this.dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
      this.dataPath = path.dirname(this.dbPath);
    } else {
      this.dataPath = path.join(app.getPath('userData'), 'stone-data');
      this.dbPath = path.join(this.dataPath, 'notes.db');
    }

    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.runInitialize().catch((error) => {
      // Clear cached promise so a subsequent initialize() can retry.
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  private async runInitialize(): Promise<void> {
    try {
      logger.info(`Database path: ${this.dbPath}`);

      this.client = createClient({ url: `file:${this.dbPath}` });
      await this.client.execute('PRAGMA foreign_keys = ON');

      this.db = drizzle(this.client, { schema });

      const migrationsPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'migrations')
        : path.join(process.cwd(), 'migrations');

      logger.info(`Migrations path: ${migrationsPath}`);
      await migrate(this.db, { migrationsFolder: migrationsPath });

      await this.seedDatabaseData();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async seedDatabaseData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const legacyConfig = await readLegacyAppearanceConfig(this.db);
    const appConfigRepository = new AppConfigRepository({
      initialConfig: {
        ...DEFAULT_APP_CONFIG,
        ...legacyConfig,
        workspace: {
          ...DEFAULT_APP_CONFIG.workspace,
          ...(legacyConfig?.workspace ?? {}),
        },
      },
    });
    const appConfig = await appConfigRepository.get();

    // Seed/refresh predefined topics. Descriptions feed the centroid seed in
    // InitializeTopicsUseCase — name-only embeddings are too weak a signal.
    const predefinedTopics = [
      {
        id: 'topic_work',
        name: 'Work',
        color: '#3b82f6',
        isPredefined: true,
        description:
          'Job, employer, meetings, deliverables, OKRs, performance, infrastructure, code reviews, on-call, customers, releases, deadlines.',
      },
      {
        id: 'topic_personal',
        name: 'Personal',
        color: '#22c55e',
        isPredefined: true,
        description:
          'Health, family, friends, finances, home, hobbies, travel, relationships, self-care, errands, food, fitness, mental wellbeing.',
      },
      {
        id: 'topic_learning',
        name: 'Learning',
        color: '#a855f7',
        isPredefined: true,
        description:
          'Courses, tutorials, books, papers, technical concepts, study notes, languages, skills practice, takeaways, references.',
      },
      {
        id: 'topic_projects',
        name: 'Projects',
        color: '#f97316',
        isPredefined: true,
        description:
          'Side projects, builds, prototypes, experiments, plans, milestones, todos, designs, scope, architecture decisions.',
      },
      {
        id: 'topic_ideas',
        name: 'Ideas',
        color: '#eab308',
        isPredefined: true,
        description:
          'Hunches, half-formed thoughts, brainstorms, product concepts, what-ifs, hypotheses, observations, sparks, inspiration.',
      },
    ];

    const existingTopicRows: Array<{ id: string; description: string | null }> = await this.db
      .select({ id: schema.topics.id, description: schema.topics.description })
      .from(schema.topics);
    if (existingTopicRows.length === 0) {
      for (const topic of predefinedTopics) {
        await this.db.insert(schema.topics).values({
          ...topic,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      logger.info('Seeded predefined topics');
    } else {
      // Backfill descriptions onto existing predefined topics that lack one,
      // and invalidate their centroid so InitializeTopicsUseCase reseeds it
      // from the now-richer text. User-edited descriptions are preserved.
      const byId = new Map(existingTopicRows.map((t) => [t.id, t]));
      let backfilled = 0;
      for (const seed of predefinedTopics) {
        const existing = byId.get(seed.id);
        if (existing && (existing.description === null || existing.description === '')) {
          await this.db
            .update(schema.topics)
            .set({ description: seed.description, centroid: null, updatedAt: new Date() })
            .where(eq(schema.topics.id, seed.id));
          backfilled++;
        }
      }
      if (backfilled > 0) {
        logger.info(`Backfilled descriptions for ${backfilled} predefined topics`);
      }
    }

    // Seed default workspace, notebooks, and notes if not present
    const seedResult = await seedDatabase(this.db, {
      workspacePath: path.join(app.getPath('userData'), appConfig.workspace.defaultWorkspacePath),
    });
    if (seedResult) {
      logger.info('Seeded default workspace:', {
        workspaceId: seedResult.workspaceId,
        workspacePath: seedResult.workspacePath,
        notebooks: seedResult.notebooks.length,
        notes: seedResult.notes.length,
      });
    }
  }

  getDrizzle() {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }

  getClient() {
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.db = null;
      // Drop cached init promise so initialize() can reopen the DB after close().
      this.initPromise = null;
      logger.info('Database connection closed');
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getDataPath(): string {
    return this.dataPath;
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run(sql`VACUUM`);
    logger.info('Database vacuumed');
  }

  async optimize(): Promise<void> {
    await this.vacuum();
  }

  async getStatus(): Promise<{
    path: string;
    size: number;
    isOpen: boolean;
  }> {
    const stats = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath) : null;
    return {
      path: this.dbPath,
      size: stats?.size ?? 0,
      isOpen: this.db !== null,
    };
  }

  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.run(sql`PRAGMA integrity_check`);
    const isOk = result?.rows?.[0]?.integrity_check === 'ok';
    return {
      ok: isOk,
      errors: isOk ? [] : [result?.rows?.[0]?.integrity_check || 'Unknown error'],
    };
  }
}

// Singleton
let instance: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  instance ??= new DatabaseManager();
  return instance;
}

export function createDatabaseManager(): DatabaseManager {
  return new DatabaseManager();
}
