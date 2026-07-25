import { Effect, Layer } from 'effect';
import {
  AIProviderKeyStorePort,
  AppConfigRepositoryPort,
  EventPublisherPort,
  GlobalShortcutRegistrarPort,
  SettingsRepositoryPort,
  SettingsUseCasesPort,
  type ISettingsUseCases,
  type ShortcutsScope,
} from '../../../domain';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { mergeAIPatch } from './aiHelpers';
import { mergeEditorPatch } from './editorHelpers';
import { mergeIntegrationsPatch } from './integrationsHelpers';
import { mergeMeetingsPatch } from './meetingsHelpers';
import { mergeOnboardingPatch } from './onboardingHelpers';
import {
  assertChordsValid,
  assertKnownAction,
  assertNoConflicts,
  assertNotReserved,
  withBinding,
  withoutBinding,
} from './shortcutsHelpers';

type SettingsScope =
  | 'appearance'
  | 'editor'
  | 'shortcuts'
  | 'ai'
  | 'meetings'
  | 'integrations'
  | 'onboarding'
  | 'quickCapture';

export const SettingsUseCasesLive = Layer.effect(
  SettingsUseCasesPort,
  Effect.gen(function* () {
    const settingsRepository = yield* SettingsRepositoryPort;
    const appConfigRepository = yield* AppConfigRepositoryPort;
    const aiProviderKeyStore = yield* AIProviderKeyStorePort;
    const globalShortcutRegistrar = yield* GlobalShortcutRegistrarPort;
    const eventPublisher = yield* EventPublisherPort;

    const publishChanged = (scope: SettingsScope) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          eventPublisher.publish({
            type: 'settings:changed',
            timestamp: new Date(now),
            payload: { scope },
          }),
        ),
      );

    const updateAndPublish = <A>(
      scope: SettingsScope,
      update: Effect.Effect<A, Error>,
    ) => update.pipe(Effect.tap(() => publishChanged(scope)));

    const service: ISettingsUseCases = {
      get: {
        execute: ({ key }) =>
          settingsRepository
            .get(key)
            .pipe(Effect.map((setting) => ({ value: setting?.value ?? null }))),
      },
      set: {
        execute: ({ key, value }) => settingsRepository.set(key, value),
      },
      getAll: {
        execute: () =>
          settingsRepository.getAll().pipe(
            Effect.map((allSettings) => ({
              settings: allSettings.map((setting) => ({
                key: setting.key,
                value: setting.value,
                updatedAt: setting.updatedAt.getTime(),
              })),
            })),
          ),
      },
      getAppearance: {
        execute: () =>
          appConfigRepository.get().pipe(Effect.map((config) => config.appearance)),
      },
      setTheme: {
        execute: ({ theme }) =>
          updateAndPublish(
            'appearance',
            appConfigRepository.update((config) => ({
              ...config,
              appearance: { ...config.appearance, theme },
            })),
          ).pipe(Effect.asVoid),
      },
      setAccentColor: {
        execute: ({ accentColor }) =>
          updateAndPublish(
            'appearance',
            appConfigRepository.update((config) => ({
              ...config,
              appearance: { ...config.appearance, accentColor },
            })),
          ).pipe(Effect.asVoid),
      },
      updateFontSettings: {
        execute: ({ fontSettings }) =>
          updateAndPublish(
            'appearance',
            appConfigRepository.update((config) => ({
              ...config,
              appearance: {
                ...config.appearance,
                fontSettings: {
                  ...config.appearance.fontSettings,
                  ...fontSettings,
                },
              },
            })),
          ).pipe(Effect.asVoid),
      },
      resetFontSettings: {
        execute: () =>
          updateAndPublish(
            'appearance',
            appConfigRepository.update((config) => ({
              ...config,
              appearance: {
                ...config.appearance,
                fontSettings: DEFAULT_APP_CONFIG.appearance.fontSettings,
              },
            })),
          ).pipe(Effect.asVoid),
      },
      getEditor: {
        execute: () =>
          appConfigRepository.get().pipe(Effect.map((config) => config.editor)),
      },
      updateEditor: {
        execute: ({ editor }) =>
          updateAndPublish(
            'editor',
            appConfigRepository.update((config) => ({
              ...config,
              editor: mergeEditorPatch(config.editor, editor),
            })),
          ).pipe(Effect.map((config) => config.editor)),
      },
      resetEditor: {
        execute: () =>
          updateAndPublish(
            'editor',
            appConfigRepository.update((config) => ({
              ...config,
              editor: DEFAULT_APP_CONFIG.editor,
            })),
          ).pipe(Effect.map((config) => config.editor)),
      },
      getShortcuts: {
        execute: () =>
          appConfigRepository.get().pipe(Effect.map((config) => config.shortcuts)),
      },
      setShortcut: {
        execute: ({ scope, action, binding }) =>
          Effect.gen(function* () {
            yield* validateShortcut(scope, action, binding);
            const current = yield* appConfigRepository.get();
            const candidate = withBinding(
              current.shortcuts,
              scope,
              action,
              binding,
            );
            yield* Effect.sync(() =>
              assertNoConflicts(scope, action, binding, candidate),
            );
            const next = yield* appConfigRepository.update((config) => ({
              ...config,
              shortcuts: candidate,
            }));
            yield* publishChanged('shortcuts');
            return next.shortcuts;
          }),
      },
      resetShortcut: {
        execute: ({ scope, action }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() => assertKnownAction(scope, action));
            const next = yield* appConfigRepository.update((config) => ({
              ...config,
              shortcuts: withoutBinding(config.shortcuts, scope, action),
            }));
            yield* publishChanged('shortcuts');
            return next.shortcuts;
          }),
      },
      resetAllShortcuts: {
        execute: () =>
          updateAndPublish(
            'shortcuts',
            appConfigRepository.update((config) => ({
              ...config,
              shortcuts: DEFAULT_APP_CONFIG.shortcuts,
            })),
          ).pipe(Effect.map((config) => config.shortcuts)),
      },
      getAI: {
        execute: () =>
          appConfigRepository.get().pipe(Effect.map((config) => config.ai)),
      },
      updateAI: {
        execute: ({ ai }) =>
          updateAndPublish(
            'ai',
            appConfigRepository.update((config) => ({
              ...config,
              ai: mergeAIPatch(config.ai, ai),
            })),
          ).pipe(Effect.map((config) => config.ai)),
      },
      resetAI: {
        execute: () =>
          updateAndPublish(
            'ai',
            appConfigRepository.update((config) => ({
              ...config,
              ai: DEFAULT_APP_CONFIG.ai,
            })),
          ).pipe(Effect.map((config) => config.ai)),
      },
      getAIProviderKeys: {
        execute: () => aiProviderKeyStore.listStatuses(),
      },
      setAIProviderKey: {
        execute: ({ provider, apiKey }) => {
          const trimmed = apiKey.trim();
          if (!trimmed) return Effect.fail(new Error('API key cannot be empty'));
          return aiProviderKeyStore.setKey(provider, trimmed).pipe(
            Effect.tap(() => publishChanged('ai')),
            Effect.flatMap(() => aiProviderKeyStore.listStatuses()),
          );
        },
      },
      deleteAIProviderKey: {
        execute: ({ provider }) =>
          aiProviderKeyStore.deleteKey(provider).pipe(
            Effect.tap(() => publishChanged('ai')),
            Effect.flatMap(() => aiProviderKeyStore.listStatuses()),
          ),
      },
      getMeetings: {
        execute: () =>
          appConfigRepository.get().pipe(Effect.map((config) => config.meetings)),
      },
      updateMeetings: {
        execute: ({ meetings }) =>
          updateAndPublish(
            'meetings',
            appConfigRepository.update((config) => ({
              ...config,
              meetings: mergeMeetingsPatch(config.meetings, meetings),
            })),
          ).pipe(Effect.map((config) => config.meetings)),
      },
      resetMeetings: {
        execute: () =>
          updateAndPublish(
            'meetings',
            appConfigRepository.update((config) => ({
              ...config,
              meetings: DEFAULT_APP_CONFIG.meetings,
            })),
          ).pipe(Effect.map((config) => config.meetings)),
      },
      getIntegrations: {
        execute: () =>
          appConfigRepository
            .get()
            .pipe(Effect.map((config) => config.integrations)),
      },
      updateIntegrations: {
        execute: ({ integrations }) =>
          updateAndPublish(
            'integrations',
            appConfigRepository.update((config) => ({
              ...config,
              integrations: mergeIntegrationsPatch(
                config.integrations,
                integrations,
              ),
            })),
          ).pipe(Effect.map((config) => config.integrations)),
      },
      getOnboarding: {
        execute: () =>
          appConfigRepository
            .get()
            .pipe(Effect.map((config) => config.onboarding)),
      },
      updateOnboarding: {
        execute: ({ onboarding }) =>
          Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
            Effect.flatMap((now) =>
              updateAndPublish(
                'onboarding',
                appConfigRepository.update((config) => ({
                  ...config,
                  onboarding: mergeOnboardingPatch(
                    config.onboarding,
                    onboarding,
                    new Date(now),
                  ),
                })),
              ),
            ),
            Effect.map((config) => config.onboarding),
          ),
      },
      resetOnboarding: {
        execute: () =>
          updateAndPublish(
            'onboarding',
            appConfigRepository.update((config) => ({
              ...config,
              onboarding: DEFAULT_APP_CONFIG.onboarding,
            })),
          ).pipe(Effect.map((config) => config.onboarding)),
      },
      getQuickCaptureShortcut: {
        execute: () =>
          globalShortcutRegistrar.getQuickCaptureStatus().pipe(
            Effect.flatMap((status) =>
              status.shortcut
                ? Effect.succeed(status)
                : appConfigRepository.get().pipe(
                    Effect.map((config) => ({
                      shortcut: config.quickCapture.shortcut,
                      registered: false,
                    })),
                  ),
            ),
          ),
      },
      setQuickCaptureShortcut: {
        execute: ({ shortcut }) => {
          const trimmed = shortcut.trim();
          return appConfigRepository
            .update((config) => ({
              ...config,
              quickCapture: { ...config.quickCapture, shortcut: trimmed },
            }))
            .pipe(
              Effect.flatMap(() =>
                globalShortcutRegistrar.bindQuickCapture(trimmed),
              ),
              Effect.tap(() => publishChanged('quickCapture')),
            );
        },
      },
    };

    return service;
  }),
);

function validateShortcut(
  scope: ShortcutsScope,
  action: string,
  binding: Parameters<ISettingsUseCases['setShortcut']['execute']>[0]['binding'],
): Effect.Effect<void, Error> {
  return Effect.sync(() => {
    assertKnownAction(scope, action);
    assertChordsValid(binding);
    assertNotReserved(binding);
  });
}
