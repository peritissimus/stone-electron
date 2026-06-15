/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetSettingUseCase,
  ISetSettingUseCase,
  IGetAllSettingsUseCase,
  IGetAppearanceSettingsUseCase,
  ISetThemeUseCase,
  ISetAccentColorUseCase,
  IUpdateFontSettingsUseCase,
  IResetFontSettingsUseCase,
  IGetEditorSettingsUseCase,
  IUpdateEditorSettingsUseCase,
  IResetEditorSettingsUseCase,
  IGetShortcutsUseCase,
  ISetShortcutUseCase,
  IResetShortcutUseCase,
  IResetAllShortcutsUseCase,
  IGetAISettingsUseCase,
  IUpdateAISettingsUseCase,
  IResetAISettingsUseCase,
  IGetAIProviderKeysUseCase,
  ISetAIProviderKeyUseCase,
  IDeleteAIProviderKeyUseCase,
  IGetMeetingsSettingsUseCase,
  IUpdateMeetingsSettingsUseCase,
  IResetMeetingsSettingsUseCase,
  IGetOnboardingUseCase,
  IUpdateOnboardingUseCase,
  IResetOnboardingUseCase,
  IGetQuickCaptureShortcutUseCase,
  ISetQuickCaptureShortcutUseCase,
  ShortcutsScope,
} from '../../../domain';
import type {
  AIConfig,
  AIProviderId,
  AppAccentColor,
  AppTheme,
  ChordBinding,
  EditorSettings,
  FontSettings,
  MeetingsConfig,
  OnboardingStepState,
} from '@shared/types/settings';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  getSetting: IGetSettingUseCase;
  setSetting: ISetSettingUseCase;
  getAllSettings: IGetAllSettingsUseCase;
  getAppearanceSettings: IGetAppearanceSettingsUseCase;
  setTheme: ISetThemeUseCase;
  setAccentColor: ISetAccentColorUseCase;
  updateFontSettings: IUpdateFontSettingsUseCase;
  resetFontSettings: IResetFontSettingsUseCase;
  getEditorSettings: IGetEditorSettingsUseCase;
  updateEditorSettings: IUpdateEditorSettingsUseCase;
  resetEditorSettings: IResetEditorSettingsUseCase;
  getShortcuts: IGetShortcutsUseCase;
  setShortcut: ISetShortcutUseCase;
  resetShortcut: IResetShortcutUseCase;
  resetAllShortcuts: IResetAllShortcutsUseCase;
  getAI: IGetAISettingsUseCase;
  updateAI: IUpdateAISettingsUseCase;
  resetAI: IResetAISettingsUseCase;
  getAIProviderKeys: IGetAIProviderKeysUseCase;
  setAIProviderKey: ISetAIProviderKeyUseCase;
  deleteAIProviderKey: IDeleteAIProviderKeyUseCase;
  getMeetings: IGetMeetingsSettingsUseCase;
  updateMeetings: IUpdateMeetingsSettingsUseCase;
  resetMeetings: IResetMeetingsSettingsUseCase;
  getOnboarding: IGetOnboardingUseCase;
  updateOnboarding: IUpdateOnboardingUseCase;
  resetOnboarding: IResetOnboardingUseCase;
  getQuickCaptureShortcut: IGetQuickCaptureShortcutUseCase;
  setQuickCaptureShortcut: ISetQuickCaptureShortcutUseCase;
}

const SHORTCUT_ERROR_MAP: Record<string, string> = {
  ShortcutConflictError: 'SHORTCUT_CONFLICT',
};

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
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
    getOnboarding,
    updateOnboarding,
    resetOnboarding,
    getQuickCaptureShortcut,
    setQuickCaptureShortcut,
  } = deps;
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

  ipcMain.handle(SETTINGS_CHANNELS.GET, async (_event, params: { key: string }) => {
    return handleRequest(
      async () => getSetting.execute({ key: params.key }),
      { channel: SETTINGS_CHANNELS.GET, key: params.key },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET, async (_event, params: { key: string; value: string }) => {
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

  ipcMain.handle(SETTINGS_CHANNELS.SET_THEME, async (_event, params: { theme: AppTheme }) => {
    return handleRequest(
      async () => {
        await setTheme.execute({ theme: params.theme });
      },
      { channel: SETTINGS_CHANNELS.SET_THEME, theme: params.theme },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_ACCENT_COLOR,
    async (_event, params: { accentColor: AppAccentColor }) => {
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
    async (_event, params: { fontSettings: Partial<FontSettings> }) => {
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
    async (_event, params: { editor: Partial<EditorSettings> }) => {
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
    async (
      _event,
      params: { scope: ShortcutsScope; action: string; binding: ChordBinding | ChordBinding[] },
    ) => {
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
    async (_event, params: { scope: ShortcutsScope; action: string }) => {
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
    async (_event, params: { ai: Partial<AIConfig> }) => {
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
    async (_event, params: { provider: AIProviderId; apiKey: string }) => {
      return handleRequest(
        async () => setAIProviderKey.execute(params),
        { channel: SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY, provider: params.provider },
      );
    },
  );

  ipcMain.handle(
    SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY,
    async (_event, params: { provider: AIProviderId }) => {
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
    async (_event, params: { meetings: Partial<MeetingsConfig> }) => {
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

  // ----- onboarding -----

  ipcMain.handle(SETTINGS_CHANNELS.GET_ONBOARDING, async () => {
    return handleRequest(
      async () => getOnboarding.execute(),
      { channel: SETTINGS_CHANNELS.GET_ONBOARDING },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_ONBOARDING,
    async (
      _event,
      params: { onboarding: { completed?: boolean; steps?: Partial<OnboardingStepState> } },
    ) => {
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
    async (_event, params: { shortcut: string }) => {
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
