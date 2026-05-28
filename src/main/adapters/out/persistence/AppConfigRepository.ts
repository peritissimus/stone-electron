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
        // No file is the legitimate first-run case — silent.
        return null;
      }

      // Anything else (parse error, EACCES, partial write left by a
      // force-quit) silently used to fall back to DEFAULT_APP_CONFIG
      // — which wipes user privacy + model picks. Log loudly so the
      // next regression is visible in the logs instead of mysterious.
      logger.warn(
        '[AppConfigRepository] Config read failed — defaults will be written and current state may be lost. Inspect the file before next launch if this is unexpected.',
        { configPath: this.configPath, error },
      );
      return null;
    }
  }

  private async writeConfig(config: AppConfig): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    // Atomic write: write to a sibling temp file then rename. POSIX rename
    // is atomic, so a crash or force-quit mid-write cannot leave the
    // canonical config.json in a half-written state. Without this, a
    // truncated file is unparseable → next read returns null →
    // DEFAULT_APP_CONFIG silently overwrites the user's settings (we
    // chased exactly that ghost once).
    const tmpPath = `${this.configPath}.tmp`;
    const body = `${JSON.stringify(config, null, 2)}\n`;
    await fs.writeFile(tmpPath, body, 'utf-8');
    await fs.rename(tmpPath, this.configPath);
  }
}
