import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SecureAIProviderKeyStore,
  type SecureAIProviderKeyStoreDeps,
} from '../../../../../src/main/adapters/out/persistence/SecureAIProviderKeyStore';

type SafeStorageMock = NonNullable<SecureAIProviderKeyStoreDeps['safeStorage']>;

function createSafeStorageMock(): SafeStorageMock {
  return {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`, 'utf-8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8').replace(/^encrypted:/, '')),
  };
}

describe('SecureAIProviderKeyStore', () => {
  let tempDir: string;
  let keyFilePath: string;
  let safeStorage: SafeStorageMock;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stone-ai-keys-'));
    keyFilePath = path.join(tempDir, 'keys.json');
    safeStorage = createSafeStorageMock();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects available providers from environment variables without exposing key values', async () => {
    const store = new SecureAIProviderKeyStore({
      keyFilePath,
      safeStorage,
      env: { OPENAI_API_KEY: 'env-openai-key' },
    });

    const statuses = await store.listStatuses();
    const openai = statuses.find((status) => status.provider === 'openai');
    const groq = statuses.find((status) => status.provider === 'groq');

    expect(openai).toMatchObject({
      envVar: 'OPENAI_API_KEY',
      hasEnvKey: true,
      hasStoredKey: false,
      available: true,
      activeSource: 'env',
    });
    expect(groq).toMatchObject({
      hasEnvKey: false,
      hasStoredKey: false,
      available: false,
      activeSource: null,
    });
    expect(JSON.stringify(statuses)).not.toContain('env-openai-key');
    await expect(store.getKey('openai')).resolves.toBe('env-openai-key');
  });

  it('stores encrypted keys and prefers stored keys over environment keys', async () => {
    const store = new SecureAIProviderKeyStore({
      keyFilePath,
      safeStorage,
      env: { OPENAI_API_KEY: 'env-openai-key' },
    });

    await store.setKey('openai', 'stored-openai-key');

    const rawFile = await fs.readFile(keyFilePath, 'utf-8');
    expect(rawFile).not.toContain('stored-openai-key');
    expect(rawFile).not.toContain('env-openai-key');
    await expect(store.getKey('openai')).resolves.toBe('stored-openai-key');

    const status = (await store.listStatuses()).find((item) => item.provider === 'openai');
    expect(status).toMatchObject({
      hasEnvKey: true,
      hasStoredKey: true,
      available: true,
      activeSource: 'stored',
    });
  });

  it('falls back to an environment key after deleting a stored key', async () => {
    const store = new SecureAIProviderKeyStore({
      keyFilePath,
      safeStorage,
      env: { OPENAI_API_KEY: 'env-openai-key' },
    });

    await store.setKey('openai', 'stored-openai-key');
    await store.deleteKey('openai');

    await expect(store.getKey('openai')).resolves.toBe('env-openai-key');
    const status = (await store.listStatuses()).find((item) => item.provider === 'openai');
    expect(status).toMatchObject({
      hasEnvKey: true,
      hasStoredKey: false,
      activeSource: 'env',
    });
  });

  it('rejects stored keys when secure credential storage is unavailable', async () => {
    const unavailableSafeStorage: SafeStorageMock = {
      ...safeStorage,
      isEncryptionAvailable: vi.fn(() => false),
    };
    const store = new SecureAIProviderKeyStore({
      keyFilePath,
      safeStorage: unavailableSafeStorage,
      env: {},
    });

    await expect(store.setKey('openai', 'stored-openai-key')).rejects.toThrow(
      'Secure credential storage is not available on this system',
    );
  });
});
