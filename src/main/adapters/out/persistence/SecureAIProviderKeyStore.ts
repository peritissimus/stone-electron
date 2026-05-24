import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { SafeStorage } from 'electron';
import type {
  AIProviderId,
  AIProviderKeyStatus,
  IAIProviderKeyStore,
} from '../../../domain';
import { AI_PROVIDER_DEFINITIONS } from '../../../domain';
import { handleOperation, logger } from '../../../shared/utils';

interface StoredProviderKey {
  encryptedValue: string;
  updatedAt: string;
}

interface StoredProviderKeysFile {
  version: 1;
  providers: Partial<Record<AIProviderId, StoredProviderKey>>;
}

type EnvMap = Record<string, string | undefined>;

let app: { getPath: (name: string) => string } | null = null;
let electronSafeStorage: SafeStorage | null = null;

try {
  const electron = require('electron');
  if (typeof electron !== 'string' && electron.app) {
    app = electron.app;
    electronSafeStorage = electron.safeStorage;
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
  };
}

export interface SecureAIProviderKeyStoreDeps {
  keyFilePath?: string;
  safeStorage?: Pick<SafeStorage, 'isEncryptionAvailable' | 'encryptString' | 'decryptString'>;
  env?: EnvMap;
}

export class SecureAIProviderKeyStore implements IAIProviderKeyStore {
  private readonly keyFilePath: string;
  private readonly safeStorage: SecureAIProviderKeyStoreDeps['safeStorage'] | null;
  private readonly env: EnvMap;

  constructor(private readonly deps: SecureAIProviderKeyStoreDeps = {}) {
    this.keyFilePath =
      deps.keyFilePath ?? path.join(app!.getPath('userData'), 'ai-provider-keys.json');
    this.safeStorage = deps.safeStorage ?? electronSafeStorage;
    this.env = deps.env ?? process.env;
  }

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, {
      adapter: 'SecureAIProviderKeyStore',
      operation,
      context,
    });
  }

  async listStatuses(): Promise<AIProviderKeyStatus[]> {
    return this.handle('listStatuses', async () => {
      const stored = await this.readFile();
      return AI_PROVIDER_DEFINITIONS.map((definition) => {
        const hasEnvKey = Boolean(this.env[definition.envVar]?.trim());
        const hasStoredKey = Boolean(stored.providers[definition.id]);
        const activeSource = hasStoredKey ? 'stored' : hasEnvKey ? 'env' : null;
        return {
          provider: definition.id,
          label: definition.label,
          envVar: definition.envVar,
          hasEnvKey,
          hasStoredKey,
          available: hasEnvKey || hasStoredKey,
          activeSource,
        };
      });
    });
  }

  async getKey(provider: AIProviderId): Promise<string | null> {
    return this.handle(
      'getKey',
      async () => {
        const stored = await this.readFile();
        const storedKey = stored.providers[provider];
        if (storedKey) {
          return this.decrypt(storedKey.encryptedValue);
        }

        const definition = AI_PROVIDER_DEFINITIONS.find((item) => item.id === provider);
        if (!definition) return null;
        return this.env[definition.envVar]?.trim() || null;
      },
      { provider },
    );
  }

  async setKey(provider: AIProviderId, apiKey: string): Promise<void> {
    await this.handle(
      'setKey',
      async () => {
        const stored = await this.readFile();
        stored.providers[provider] = {
          encryptedValue: this.encrypt(apiKey),
          updatedAt: new Date().toISOString(),
        };
        await this.writeFile(stored);
      },
      { provider },
    );
  }

  async deleteKey(provider: AIProviderId): Promise<void> {
    await this.handle(
      'deleteKey',
      async () => {
        const stored = await this.readFile();
        delete stored.providers[provider];
        await this.writeFile(stored);
      },
      { provider },
    );
  }

  private encrypt(value: string): string {
    if (!this.safeStorage?.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is not available on this system');
    }
    return this.safeStorage.encryptString(value).toString('base64');
  }

  private decrypt(value: string): string {
    if (!this.safeStorage?.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is not available on this system');
    }
    return this.safeStorage.decryptString(Buffer.from(value, 'base64'));
  }

  private async readFile(): Promise<StoredProviderKeysFile> {
    try {
      const raw = await fs.readFile(this.keyFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return normalizeStoredKeys(parsed);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== 'ENOENT') {
        logger.warn('Failed to read AI provider key store; using empty store', {
          keyFilePath: this.keyFilePath,
          error,
        });
      }
      return { version: 1, providers: {} };
    }
  }

  private async writeFile(value: StoredProviderKeysFile): Promise<void> {
    await fs.mkdir(path.dirname(this.keyFilePath), { recursive: true });
    await fs.writeFile(this.keyFilePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
    await fs.chmod(this.keyFilePath, 0o600);
  }
}

function normalizeStoredKeys(value: unknown): StoredProviderKeysFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { version: 1, providers: {} };
  }

  const providersValue = (value as { providers?: unknown }).providers;
  if (typeof providersValue !== 'object' || providersValue === null || Array.isArray(providersValue)) {
    return { version: 1, providers: {} };
  }

  const providers: Partial<Record<AIProviderId, StoredProviderKey>> = {};
  for (const definition of AI_PROVIDER_DEFINITIONS) {
    const candidate = (providersValue as Record<string, unknown>)[definition.id];
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue;

    const encryptedValue = (candidate as { encryptedValue?: unknown }).encryptedValue;
    const updatedAt = (candidate as { updatedAt?: unknown }).updatedAt;
    if (typeof encryptedValue !== 'string' || encryptedValue.length === 0) continue;

    providers[definition.id] = {
      encryptedValue,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date(0).toISOString(),
    };
  }

  return { version: 1, providers };
}
