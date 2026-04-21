import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { type AppConfig, DEFAULT_APP_CONFIG } from '@shared/types/settings';
import type { IAppConfigRepository } from '../../../domain';
import { handleOperation, logger } from '../../../shared/utils';
import { normalizeConfig } from './appConfigNormalize';

let app: { getPath: (name: string) => string; isPackaged?: boolean } | null = null;
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

export interface AppConfigRepositoryDeps {
  configPath?: string;
  initialConfig?: AppConfig;
}

export class AppConfigRepository implements IAppConfigRepository {
  private readonly configPath: string;

  constructor(private readonly deps: AppConfigRepositoryDeps = {}) {
    this.configPath = deps.configPath ?? path.join(app!.getPath('userData'), 'config.json');
  }

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'AppConfigRepository', operation, context });
  }

  async get(): Promise<AppConfig> {
    return this.handle('get', async () => await this.loadConfig(), { configPath: this.configPath });
  }

  async set(config: AppConfig): Promise<void> {
    await this.handle('set', async () => {
      const normalized = normalizeConfig(config);
      await this.writeConfig(normalized);
    }, { configPath: this.configPath });
  }

  async update(updater: (config: AppConfig) => AppConfig): Promise<AppConfig> {
    return this.handle('update', async () => {
      const current = await this.loadConfig();
      const next = normalizeConfig(updater(current));
      await this.writeConfig(next);
      return next;
    }, { configPath: this.configPath });
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private async loadConfig(): Promise<AppConfig> {
    const existing = await this.readConfigFile();
    if (existing) {
      const normalized = normalizeConfig(existing);
      await this.writeConfig(normalized);
      return normalized;
    }

    const initialConfig = normalizeConfig(this.deps.initialConfig ?? DEFAULT_APP_CONFIG);
    await this.writeConfig(initialConfig);
    return initialConfig;
  }

  private async readConfigFile(): Promise<unknown | null> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      if (code === 'ENOENT') {
        return null;
      }

      logger.warn('Failed to read app config file, falling back to defaults', {
        configPath: this.configPath,
        error,
      });
      return null;
    }
  }

  private async writeConfig(config: AppConfig): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  }
}
