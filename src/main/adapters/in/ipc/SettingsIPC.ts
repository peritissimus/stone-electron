/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import {
  DeleteAIProviderKeyRequestSchema,
  ResetShortcutRequestSchema,
  SetAccentColorRequestSchema,
  SetAIProviderKeyRequestSchema,
  SetQuickCaptureShortcutRequestSchema,
  SetSettingRequestSchema,
  SetShortcutRequestSchema,
  SetThemeRequestSchema,
  SettingKeyRequestSchema,
  UpdateAIRequestSchema,
  UpdateEditorRequestSchema,
  UpdateFontSettingsRequestSchema,
  UpdateIntegrationsRequestSchema,
  UpdateMeetingsRequestSchema,
  UpdateOnboardingRequestSchema,
} from '@shared/schemas';
import type { ISettingsUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  runSettingsEffect: RunSettingsEffect;
}

export type RunSettingsEffect = <A, E>(
  use: (service: ISettingsUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

type PromiseSettings<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseSettings<T[Key]> }
    : T;

const SHORTCUT_ERROR_MAP: Record<string, string> = {
  ShortcutConflictError: 'SHORTCUT_CONFLICT',
};

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
  const run = deps.runSettingsEffect;
  const facade: PromiseSettings<ISettingsUseCases> = {
    get: { execute: (request) => run((service) => service.get.execute(request)) },
    set: { execute: (request) => run((service) => service.set.execute(request)) },
    getAll: { execute: () => run((service) => service.getAll.execute()) },
    getAppearance: {
      execute: () => run((service) => service.getAppearance.execute()),
    },
    setTheme: {
      execute: (request) => run((service) => service.setTheme.execute(request)),
    },
    setAccentColor: {
      execute: (request) =>
        run((service) => service.setAccentColor.execute(request)),
    },
    updateFontSettings: {
      execute: (request) =>
        run((service) => service.updateFontSettings.execute(request)),
    },
    resetFontSettings: {
      execute: () => run((service) => service.resetFontSettings.execute()),
    },
    getEditor: {
      execute: () => run((service) => service.getEditor.execute()),
    },
    updateEditor: {
      execute: (request) =>
        run((service) => service.updateEditor.execute(request)),
    },
    resetEditor: {
      execute: () => run((service) => service.resetEditor.execute()),
    },
    getShortcuts: {
      execute: () => run((service) => service.getShortcuts.execute()),
    },
    setShortcut: {
      execute: (request) =>
        run((service) => service.setShortcut.execute(request)),
    },
    resetShortcut: {
      execute: (request) =>
        run((service) => service.resetShortcut.execute(request)),
    },
    resetAllShortcuts: {
      execute: () => run((service) => service.resetAllShortcuts.execute()),
    },
    getAI: { execute: () => run((service) => service.getAI.execute()) },
    updateAI: {
      execute: (request) => run((service) => service.updateAI.execute(request)),
    },
    resetAI: { execute: () => run((service) => service.resetAI.execute()) },
    getAIProviderKeys: {
      execute: () => run((service) => service.getAIProviderKeys.execute()),
    },
    setAIProviderKey: {
      execute: (request) =>
        run((service) => service.setAIProviderKey.execute(request)),
    },
    deleteAIProviderKey: {
      execute: (request) =>
        run((service) => service.deleteAIProviderKey.execute(request)),
    },
    getMeetings: {
      execute: () => run((service) => service.getMeetings.execute()),
    },
    updateMeetings: {
      execute: (request) =>
        run((service) => service.updateMeetings.execute(request)),
    },
    resetMeetings: {
      execute: () => run((service) => service.resetMeetings.execute()),
    },
    getIntegrations: {
      execute: () => run((service) => service.getIntegrations.execute()),
    },
    updateIntegrations: {
      execute: (request) =>
        run((service) => service.updateIntegrations.execute(request)),
    },
    getOnboarding: {
      execute: () => run((service) => service.getOnboarding.execute()),
    },
    updateOnboarding: {
      execute: (request) =>
        run((service) => service.updateOnboarding.execute(request)),
    },
    resetOnboarding: {
      execute: () => run((service) => service.resetOnboarding.execute()),
    },
    getQuickCaptureShortcut: {
      execute: () =>
        run((service) => service.getQuickCaptureShortcut.execute()),
    },
    setQuickCaptureShortcut: {
      execute: (request) =>
        run((service) => service.setQuickCaptureShortcut.execute(request)),
    },
  };
  const {
    getSetting,
    setSetting,
    getAllSettings,
    getAppearanceSettings,
    setTheme,
    setAccentColor,
    updateFontSettings,
    resetFontSettings,
    getEditorSettings,
    updateEditorSettings,
    resetEditorSettings,
    getShortcuts,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    getAI,
    updateAI,
    resetAI,
    getAIProviderKeys,
    setAIProviderKey,
    deleteAIProviderKey,
    getMeetings,
    updateMeetings,
    resetMeetings,
    getIntegrations,
    updateIntegrations,
    getOnboarding,
    updateOnboarding,
    resetOnboarding,
    getQuickCaptureShortcut,
    setQuickCaptureShortcut,
  } = {
    getSetting: facade.get,
    setSetting: facade.set,
    getAllSettings: facade.getAll,
    getAppearanceSettings: facade.getAppearance,
    setTheme: facade.setTheme,
    setAccentColor: facade.setAccentColor,
    updateFontSettings: facade.updateFontSettings,
    resetFontSettings: facade.resetFontSettings,
    getEditorSettings: facade.getEditor,
    updateEditorSettings: facade.updateEditor,
    resetEditorSettings: facade.resetEditor,
    getShortcuts: facade.getShortcuts,
    setShortcut: facade.setShortcut,
    resetShortcut: facade.resetShortcut,
    resetAllShortcuts: facade.resetAllShortcuts,
    getAI: facade.getAI,
    updateAI: facade.updateAI,
    resetAI: facade.resetAI,
    getAIProviderKeys: facade.getAIProviderKeys,
    setAIProviderKey: facade.setAIProviderKey,
    deleteAIProviderKey: facade.deleteAIProviderKey,
    getMeetings: facade.getMeetings,
    updateMeetings: facade.updateMeetings,
    resetMeetings: facade.resetMeetings,
    getIntegrations: facade.getIntegrations,
    updateIntegrations: facade.updateIntegrations,
    getOnboarding: facade.getOnboarding,
    updateOnboarding: facade.updateOnboarding,
    resetOnboarding: facade.resetOnboarding,
    getQuickCaptureShortcut: facade.getQuickCaptureShortcut,
    setQuickCaptureShortcut: facade.setQuickCaptureShortcut,
  };
  const handleRequest = <T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
    extra?: { errorMap?: Record<string, string> },
  ) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'SettingsIPC',
      defaultCode: 'INTERNAL_ERROR',
      context,
      errorMap: extra?.errorMap,
    });

  ipcMain.handle(SETTINGS_CHANNELS.GET, async (_event, rawRequest) => {
    const params = SettingKeyRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => getSetting.execute({ key: params.key }),
      { channel: SETTINGS_CHANNELS.GET, key: params.key },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET, async (_event, rawRequest) => {
    const params = SetSettingRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        await setSetting.execute({ key: params.key, value: params.value });
      },
      { channel: SETTINGS_CHANNELS.SET, key: params.key },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_ALL, async () => {
    return handleRequest(
      async () => getAllSettings.execute(),
      { channel: SETTINGS_CHANNELS.GET_ALL },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_APPEARANCE, async () => {
    return handleRequest(
      async () => getAppearanceSettings.execute(),
      { channel: SETTINGS_CHANNELS.GET_APPEARANCE },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET_THEME, async (_event, rawRequest) => {
    const params = SetThemeRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        await setTheme.execute({ theme: params.theme });
      },
      { channel: SETTINGS_CHANNELS.SET_THEME, theme: params.theme },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_ACCENT_COLOR,
    async (_event, rawRequest) => {
      const params = SetAccentColorRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          await setAccentColor.execute({ accentColor: params.accentColor });
        },
        { channel: SETTINGS_CHANNELS.SET_ACCENT_COLOR, accentColor: params.accentColor },
      );
    },
  );

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS,
    async (_event, rawRequest) => {
      const params = UpdateFontSettingsRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          await updateFontSettings.execute({ fontSettings: params.fontSettings });
        },
        { channel: SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_FONT_SETTINGS, async () => {
    return handleRequest(
      async () => {
        await resetFontSettings.execute();
      },
      { channel: SETTINGS_CHANNELS.RESET_FONT_SETTINGS },
    );
  });

  // ----- editor settings -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_EDITOR, async () => {
    return handleRequest(
      async () => getEditorSettings.execute(),
      { channel: SETTINGS_CHANNELS.GET_EDITOR },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_EDITOR,
    async (_event, rawRequest) => {
      const params = UpdateEditorRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => updateEditorSettings.execute({ editor: params.editor }),
        { channel: SETTINGS_CHANNELS.UPDATE_EDITOR },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_EDITOR, async () => {
    return handleRequest(
      async () => resetEditorSettings.execute(),
      { channel: SETTINGS_CHANNELS.RESET_EDITOR },
    );
  });

  // ----- shortcuts -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_SHORTCUTS, async () => {
    return handleRequest(
      async () => getShortcuts.execute(),
      { channel: SETTINGS_CHANNELS.GET_SHORTCUTS },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_SHORTCUT,
    async (_event, rawRequest) => {
      const params = SetShortcutRequestSchema.parse(rawRequest);
      return handleRequest(
        async () =>
          setShortcut.execute({
            scope: params.scope,
            action: params.action,
            binding: params.binding,
          }),
        { channel: SETTINGS_CHANNELS.SET_SHORTCUT, scope: params.scope, action: params.action },
        { errorMap: SHORTCUT_ERROR_MAP },
      );
    },
  );

  ipcMain.handle(
    SETTINGS_CHANNELS.RESET_SHORTCUT,
    async (_event, rawRequest) => {
      const params = ResetShortcutRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => resetShortcut.execute({ scope: params.scope, action: params.action }),
        { channel: SETTINGS_CHANNELS.RESET_SHORTCUT, scope: params.scope, action: params.action },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_ALL_SHORTCUTS, async () => {
    return handleRequest(
      async () => resetAllShortcuts.execute(),
      { channel: SETTINGS_CHANNELS.RESET_ALL_SHORTCUTS },
    );
  });

  // ----- AI settings -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_AI, async () => {
    return handleRequest(async () => getAI.execute(), { channel: SETTINGS_CHANNELS.GET_AI });
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_AI,
    async (_event, rawRequest) => {
      const params = UpdateAIRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => updateAI.execute({ ai: params.ai }),
        { channel: SETTINGS_CHANNELS.UPDATE_AI },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_AI, async () => {
    return handleRequest(async () => resetAI.execute(), { channel: SETTINGS_CHANNELS.RESET_AI });
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_AI_PROVIDER_KEYS, async () => {
    return handleRequest(
      async () => getAIProviderKeys.execute(),
      { channel: SETTINGS_CHANNELS.GET_AI_PROVIDER_KEYS },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY,
    async (_event, rawRequest) => {
      const params = SetAIProviderKeyRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => setAIProviderKey.execute(params),
        { channel: SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY, provider: params.provider },
      );
    },
  );

  ipcMain.handle(
    SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY,
    async (_event, rawRequest) => {
      const params = DeleteAIProviderKeyRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => deleteAIProviderKey.execute(params),
        { channel: SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY, provider: params.provider },
      );
    },
  );

  // ----- meetings settings -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_MEETINGS, async () => {
    return handleRequest(
      async () => getMeetings.execute(),
      { channel: SETTINGS_CHANNELS.GET_MEETINGS },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_MEETINGS,
    async (_event, rawRequest) => {
      const params = UpdateMeetingsRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => updateMeetings.execute({ meetings: params.meetings }),
        { channel: SETTINGS_CHANNELS.UPDATE_MEETINGS },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_MEETINGS, async () => {
    return handleRequest(
      async () => resetMeetings.execute(),
      { channel: SETTINGS_CHANNELS.RESET_MEETINGS },
    );
  });

  // ----- integrations settings -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_INTEGRATIONS, async () => {
    return handleRequest(
      async () => getIntegrations.execute(),
      { channel: SETTINGS_CHANNELS.GET_INTEGRATIONS },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_INTEGRATIONS,
    async (_event, rawRequest) => {
      const params = UpdateIntegrationsRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => updateIntegrations.execute({ integrations: params.integrations }),
        { channel: SETTINGS_CHANNELS.UPDATE_INTEGRATIONS },
      );
    },
  );

  // ----- onboarding -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_ONBOARDING, async () => {
    return handleRequest(
      async () => getOnboarding.execute(),
      { channel: SETTINGS_CHANNELS.GET_ONBOARDING },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_ONBOARDING,
    async (_event, rawRequest) => {
      const params = UpdateOnboardingRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => updateOnboarding.execute({ onboarding: params.onboarding }),
        { channel: SETTINGS_CHANNELS.UPDATE_ONBOARDING },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_ONBOARDING, async () => {
    return handleRequest(
      async () => resetOnboarding.execute(),
      { channel: SETTINGS_CHANNELS.RESET_ONBOARDING },
    );
  });

  // ----- quick capture global hotkey -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_QUICK_CAPTURE_SHORTCUT, async () => {
    return handleRequest(
      async () => getQuickCaptureShortcut.execute(),
      { channel: SETTINGS_CHANNELS.GET_QUICK_CAPTURE_SHORTCUT },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_QUICK_CAPTURE_SHORTCUT,
    async (_event, rawRequest) => {
      const params = SetQuickCaptureShortcutRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => setQuickCaptureShortcut.execute({ shortcut: params.shortcut }),
        { channel: SETTINGS_CHANNELS.SET_QUICK_CAPTURE_SHORTCUT },
      );
    },
  );

  logger.info('[IPC] Settings handlers registered');
}

export function unregisterSettingsHandlers(): void {
  Object.values(SETTINGS_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
