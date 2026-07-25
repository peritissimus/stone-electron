/**
 * SettingsUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { SettingsUseCasesLive } from '../../../../src/main/application/usecases/settings';
import {
  AIProviderKeyStorePort,
  AppConfigRepositoryPort,
  EventPublisherPort,
  GlobalShortcutRegistrarPort,
  SettingsRepositoryPort,
  SettingsUseCasesPort,
} from '../../../../src/main/domain';
import { adapterLayer } from '../../../helpers/adapterLayer';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { ISettingsRepository } from '../../../../src/main/domain/ports/out/ISettingsRepository';
import type { IAIProviderKeyStore } from '../../../../src/main/domain/ports/out/IAIProviderKeyStore';
import type { IGlobalShortcutRegistrar } from '../../../../src/main/domain/ports/out/IGlobalShortcutRegistrar';
import type { ISettingsUseCases } from '../../../../src/main/domain/ports/in/ISettingsUseCases';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import { ShortcutConflictError } from '../../../../src/main/domain/errors';
import { DEFAULT_APP_CONFIG, type AppConfig } from '../../../../src/shared/types/settings';

type PromiseSettings<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseSettings<T[Key]> }
    : T;

function makePromiseFacade(
  runtime: ManagedRuntime.ManagedRuntime<ISettingsUseCases, never>,
): PromiseSettings<ISettingsUseCases> {
  const atPath = (path: PropertyKey[]): unknown =>
    new Proxy(() => undefined, {
      get: (_target, property) => atPath([...path, property]),
      apply: (_target, _thisArg, args: unknown[]) =>
        runtime.runPromiseExit(
          SettingsUseCasesPort.pipe(
            Effect.flatMap((service) => {
              let value: unknown = service;
              let owner: unknown = service;
              for (const part of path) {
                owner = value;
                value = (value as Record<PropertyKey, unknown>)[part];
              }
              return (
                value as (
                  this: unknown,
                  ...methodArgs: unknown[]
                ) => Effect.Effect<unknown, Error>
              ).apply(owner, args);
            }),
          ),
        ).then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        }),
    });
  return atPath([]) as PromiseSettings<ISettingsUseCases>;
}

// Mock factories
function createMockSettingsRepository(): ISettingsRepository {
  return {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn(),
    delete: vi.fn(),
  } as unknown as ISettingsRepository;
}

/**
 * Stateful AppConfig mock — preserves mutations between calls so that
 * sequences like "set → get → set" reflect real repository behavior.
 */
function createMockAppConfigRepository(
  initial: AppConfig = DEFAULT_APP_CONFIG,
): IAppConfigRepository {
  let state: AppConfig = initial;
  return {
    get: vi.fn(async () => state),
    set: vi.fn(async (config: AppConfig) => {
      state = config;
    }),
    update: vi.fn(async (updater: (config: AppConfig) => AppConfig) => {
      state = updater(state);
      return state;
    }),
  } as unknown as IAppConfigRepository;
}

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: vi.fn(),
    publishAll: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    subscribeAll: vi.fn(() => () => undefined),
  } as unknown as IEventPublisher;
}

function createMockAIProviderKeyStore(): IAIProviderKeyStore {
  return {
    listStatuses: vi.fn(async () => []),
    getKey: vi.fn(async () => null),
    setKey: vi.fn(async () => undefined),
    deleteKey: vi.fn(async () => undefined),
  };
}

function createMockGlobalShortcutRegistrar(): IGlobalShortcutRegistrar {
  return {
    bindQuickCapture: vi.fn((shortcut: string) => ({ shortcut, registered: Boolean(shortcut) })),
    getQuickCaptureStatus: vi.fn(() => ({ shortcut: '', registered: false })),
  };
}

describe('SettingsUseCases', () => {
  let settingsRepository: ISettingsRepository;
  let appConfigRepository: IAppConfigRepository;
  let aiProviderKeyStore: IAIProviderKeyStore;
  let globalShortcutRegistrar: IGlobalShortcutRegistrar;
  let eventPublisher: IEventPublisher;
  let useCases: PromiseSettings<ISettingsUseCases>;

  beforeEach(() => {
    settingsRepository = createMockSettingsRepository();
    appConfigRepository = createMockAppConfigRepository();
    aiProviderKeyStore = createMockAIProviderKeyStore();
    globalShortcutRegistrar = createMockGlobalShortcutRegistrar();
    eventPublisher = createMockEventPublisher();
    const dependencies = Layer.mergeAll(
      adapterLayer(SettingsRepositoryPort, settingsRepository),
      adapterLayer(AppConfigRepositoryPort, appConfigRepository),
      adapterLayer(AIProviderKeyStorePort, aiProviderKeyStore),
      adapterLayer(GlobalShortcutRegistrarPort, globalShortcutRegistrar),
      adapterLayer(EventPublisherPort, eventPublisher),
    );
    const runtime = ManagedRuntime.make(
      SettingsUseCasesLive.pipe(Layer.provide(dependencies)),
    );
    useCases = makePromiseFacade(runtime);
  });

  describe('get', () => {
    it('returns setting value when found', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue({
        key: 'theme',
        value: 'dark',
        updatedAt: new Date(),
      });

      const result = await useCases.get.execute({ key: 'theme' });

      expect(result.value).toBe('dark');
      expect(settingsRepository.get).toHaveBeenCalledWith('theme');
    });

    it('returns null when setting not found', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue(null);

      const result = await useCases.get.execute({ key: 'nonexistent' });

      expect(result.value).toBeNull();
    });

    it('returns null when setting value is undefined', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue({
        key: 'empty',
        value: undefined as unknown as string,
        updatedAt: new Date(),
      });

      const result = await useCases.get.execute({ key: 'empty' });

      expect(result.value).toBeNull();
    });
  });

  describe('calendar integration selection', () => {
    it('persists a normalized subset without changing the Linear key', async () => {
      await useCases.updateIntegrations.execute({
        integrations: { linearApiKey: ' lin_api_existing ' },
      });

      const result = await useCases.updateIntegrations.execute({
        integrations: { selectedCalendarIds: [' work ', 'family', 'work'] },
      });

      expect(result).toEqual({
        linearApiKey: 'lin_api_existing',
        selectedCalendarIds: ['work', 'family'],
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settings:changed',
          payload: { scope: 'integrations' },
        }),
      );
    });
  });

  describe('set', () => {
    it('saves setting value', async () => {
      vi.mocked(settingsRepository.set).mockResolvedValue({
        key: 'theme',
        value: 'light',
        updatedAt: new Date(),
      });

      await useCases.set.execute({ key: 'theme', value: 'light' });

      expect(settingsRepository.set).toHaveBeenCalledWith('theme', 'light');
    });

    it('overwrites existing setting', async () => {
      vi.mocked(settingsRepository.set).mockResolvedValue({
        key: 'fontSize',
        value: '16',
        updatedAt: new Date(),
      });

      await useCases.set.execute({ key: 'fontSize', value: '16' });

      expect(settingsRepository.set).toHaveBeenCalledWith('fontSize', '16');
    });
  });

  describe('getAll', () => {
    it('returns all settings', async () => {
      const allSettings = [
        { key: 'theme', value: 'dark', updatedAt: new Date('2024-01-01') },
        { key: 'fontSize', value: '14', updatedAt: new Date('2024-01-02') },
      ];
      vi.mocked(settingsRepository.getAll).mockResolvedValue(allSettings);

      const result = await useCases.getAll.execute();

      expect(result.settings).toHaveLength(2);
      expect(result.settings[0].key).toBe('theme');
      expect(result.settings[0].value).toBe('dark');
      expect(result.settings[0].updatedAt).toBe(new Date('2024-01-01').getTime());
    });

    it('returns empty array when no settings', async () => {
      vi.mocked(settingsRepository.getAll).mockResolvedValue([]);

      const result = await useCases.getAll.execute();

      expect(result.settings).toHaveLength(0);
    });
  });

  describe('editor', () => {
    it('returns current editor settings', async () => {
      const result = await useCases.getEditor.execute();
      expect(result).toEqual(DEFAULT_APP_CONFIG.editor);
    });

    it('updates a single field via deep merge', async () => {
      const result = await useCases.updateEditor.execute({
        editor: { behavior: { placeholder: 'Custom prompt', defaultMode: 'rich' } },
      });
      expect(result.behavior.placeholder).toBe('Custom prompt');
      // sibling slices preserved
      expect(result.indent).toEqual(DEFAULT_APP_CONFIG.editor.indent);
    });

    it('publishes settings:changed with editor scope on update', async () => {
      await useCases.updateEditor.execute({
        editor: { behavior: { placeholder: 'X', defaultMode: 'rich' } },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settings:changed', payload: { scope: 'editor' } }),
      );
    });

    it('reset restores defaults and emits event', async () => {
      await useCases.updateEditor.execute({
        editor: { behavior: { placeholder: 'X', defaultMode: 'raw' } },
      });
      const reset = await useCases.resetEditor.execute();
      expect(reset).toEqual(DEFAULT_APP_CONFIG.editor);
      expect(eventPublisher.publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'settings:changed', payload: { scope: 'editor' } }),
      );
    });
  });

  describe('meetings', () => {
    it('returns current meetings settings', async () => {
      const result = await useCases.getMeetings.execute();
      expect(result).toEqual(DEFAULT_APP_CONFIG.meetings);
    });

    it('updates the retention window and emits a meetings-scoped event', async () => {
      const result = await useCases.updateMeetings.execute({ meetings: { audioRetentionDays: 7 } });
      expect(result.audioRetentionDays).toBe(7);
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settings:changed', payload: { scope: 'meetings' } }),
      );
    });

    it('accepts the -1 "delete after transcribing" sentinel', async () => {
      const result = await useCases.updateMeetings.execute({
        meetings: { audioRetentionDays: -1 },
      });
      expect(result.audioRetentionDays).toBe(-1);
    });

    it('rejects invalid retention values by keeping the current one', async () => {
      await useCases.updateMeetings.execute({ meetings: { audioRetentionDays: 30 } });
      const result = await useCases.updateMeetings.execute({
        meetings: { audioRetentionDays: -5 },
      });
      expect(result.audioRetentionDays).toBe(30);
    });

    it('reset restores the default retention window', async () => {
      await useCases.updateMeetings.execute({ meetings: { audioRetentionDays: 90 } });
      const reset = await useCases.resetMeetings.execute();
      expect(reset).toEqual(DEFAULT_APP_CONFIG.meetings);
    });
  });

  describe('shortcuts', () => {
    it('returns empty overrides when none set', async () => {
      const result = await useCases.getShortcuts.execute();
      expect(result).toEqual(DEFAULT_APP_CONFIG.shortcuts);
    });

    it('sets a valid app shortcut and emits event', async () => {
      const result = await useCases.setShortcut.execute({
        scope: 'app',
        action: 'save',
        binding: 'Mod-Alt-s',
      });
      expect(result.app.save).toBe('Mod-Alt-s');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settings:changed', payload: { scope: 'shortcuts' } }),
      );
    });

    it('rejects unknown action', async () => {
      await expect(
        useCases.setShortcut.execute({ scope: 'app', action: 'nope', binding: 'Mod-q' }),
      ).rejects.toBeInstanceOf(ShortcutConflictError);
    });

    it('rejects invalid chord syntax', async () => {
      await expect(
        useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'NotAChord' }),
      ).rejects.toBeInstanceOf(ShortcutConflictError);
    });

    it('rejects reserved StarterKit chord', async () => {
      await expect(
        useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'Mod-b' }),
      ).rejects.toMatchObject({ reserved: true });
    });

    it('rejects chord that conflicts with another action', async () => {
      // commandCenter defaults to Mod-k; binding save to Mod-k would conflict.
      await expect(
        useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'Mod-k' }),
      ).rejects.toBeInstanceOf(ShortcutConflictError);
    });

    it('does NOT publish on rejection', async () => {
      await expect(
        useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'Mod-b' }),
      ).rejects.toThrow();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('resetShortcut removes a single override', async () => {
      await useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'Mod-Alt-s' });
      const after = await useCases.resetShortcut.execute({ scope: 'app', action: 'save' });
      expect(after.app.save).toBeUndefined();
    });

    it('resetAllShortcuts clears all overrides', async () => {
      await useCases.setShortcut.execute({ scope: 'app', action: 'save', binding: 'Mod-Alt-s' });
      await useCases.setShortcut.execute({
        scope: 'editor',
        action: 'indent',
        binding: 'Mod-]',
      });
      const after = await useCases.resetAllShortcuts.execute();
      expect(after).toEqual(DEFAULT_APP_CONFIG.shortcuts);
    });
  });
});
