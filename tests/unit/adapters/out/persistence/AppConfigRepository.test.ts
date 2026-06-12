import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_CONFIG } from '../../../../../src/shared/types/settings';
import { AppConfigRepository } from '../../../../../src/main/adapters/out/persistence/AppConfigRepository';

describe('AppConfigRepository', () => {
  let root: string;
  let configPath: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'stone-config-'));
    configPath = path.join(root, 'nested', 'config.json');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('creates a normalized config on first read using the provided initial config', async () => {
    const repository = new AppConfigRepository({
      configPath,
      initialConfig: {
        ...DEFAULT_APP_CONFIG,
        appearance: {
          ...DEFAULT_APP_CONFIG.appearance,
          theme: 'dark',
        },
      },
    });

    const config = await repository.get();
    const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));

    expect(config.appearance.theme).toBe('dark');
    expect(raw.appearance.theme).toBe('dark');
    expect(raw.workspace).toEqual(DEFAULT_APP_CONFIG.workspace);
    expect(repository.getConfigPath()).toBe(configPath);
  });

  it('normalizes existing partial config files and persists missing defaults back to disk', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        appearance: { theme: 'light' },
      }),
      'utf-8',
    );
    const repository = new AppConfigRepository({ configPath });

    const config = await repository.get();
    const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));

    expect(config.appearance.theme).toBe('light');
    expect(config.appearance.fontSettings).toEqual(DEFAULT_APP_CONFIG.appearance.fontSettings);
    expect(raw.editor).toEqual(DEFAULT_APP_CONFIG.editor);
  });

  it('sets and updates config through normalized atomic writes', async () => {
    const repository = new AppConfigRepository({ configPath });

    await repository.set({
      ...DEFAULT_APP_CONFIG,
      editor: {
        ...DEFAULT_APP_CONFIG.editor,
        behavior: { ...DEFAULT_APP_CONFIG.editor.behavior, defaultMode: 'raw' },
      },
    });
    const next = await repository.update((config) => ({
      ...config,
      appearance: { ...config.appearance, accentColor: 'green' },
    }));

    expect(next.editor.behavior.defaultMode).toBe('raw');
    expect(next.appearance.accentColor).toBe('green');
    await expect(repository.get()).resolves.toMatchObject({
      editor: { behavior: { defaultMode: 'raw' } },
      appearance: { accentColor: 'green' },
    });
    await expect(fs.readdir(path.dirname(configPath))).resolves.toEqual(['config.json']);
  });

  it('cleans up temporary files when an atomic rename fails', async () => {
    const repository = new AppConfigRepository({ configPath });
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('rename failed'));

    await expect(repository.set(DEFAULT_APP_CONFIG)).rejects.toThrow('rename failed');

    expect(rename).toHaveBeenCalled();
    await expect(fs.readdir(path.dirname(configPath))).resolves.toEqual([]);
  });
});
