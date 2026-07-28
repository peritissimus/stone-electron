import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Effect } from 'effect';
import type {
  AIProviderId,
  AppAccentColor,
  AppTheme,
  ISettingsUseCases,
  ShortcutsScope,
} from '../../../domain';

interface SettingsHTTPDeps {
  runSettingsEffect: <A, E>(use: (service: ISettingsUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

type Payload = Record<string, unknown>;

const sendError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error({ err: error }, 'Settings request failed');
  return reply.status(400).send({
    error: {
      code: 'SETTINGS_ERROR',
      message: error instanceof Error ? error.message : 'Settings request failed',
    },
  });
};

/** HTTP inbound adapter for persistent application settings. */
export class SettingsHTTP {
  constructor(private readonly deps: SettingsHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/settings', async (request, reply) => {
      try {
        const key = (request.query as { key?: string }).key;
        return reply.send(
          key
            ? await this.deps.runSettingsEffect((service) => service.get.execute({ key }))
            : await this.deps.runSettingsEffect((service) => service.getAll.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/settings/:scope', async (request, reply) => {
      try {
        const { scope } = request.params as { scope: string };
        const result = await this.deps.runSettingsEffect<unknown, Error>((service) => {
          switch (scope) {
            case 'appearance':
              return service.getAppearance.execute();
            case 'editor':
              return service.getEditor.execute();
            case 'shortcuts':
              return service.getShortcuts.execute();
            case 'ai':
              return service.getAI.execute();
            case 'ai-provider-keys':
              return service.getAIProviderKeys.execute();
            case 'meetings':
              return service.getMeetings.execute();
            case 'integrations':
              return service.getIntegrations.execute();
            case 'onboarding':
              return service.getOnboarding.execute();
            case 'quick-capture-shortcut':
              return service.getQuickCaptureShortcut.execute();
            default:
              return Effect.fail(new Error(`Unknown settings scope: ${scope}`));
          }
        });
        return reply.send(result);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/settings/actions/:action', async (request, reply) => {
      try {
        const { action } = request.params as { action: string };
        const payload = (request.body as Payload | undefined) ?? {};
        const result = await this.deps.runSettingsEffect<unknown, Error>((service) => {
          switch (action) {
            case 'set':
              return service.set.execute({
                key: String(payload.key),
                value:
                  typeof payload.value === 'string' ? payload.value : JSON.stringify(payload.value),
              });
            case 'set-theme':
              return service.setTheme.execute({
                theme: payload.theme as AppTheme,
              });
            case 'set-accent-color':
              return service.setAccentColor.execute({
                accentColor: payload.accentColor as AppAccentColor,
              });
            case 'update-font-settings':
              return service.updateFontSettings.execute({
                fontSettings: payload.fontSettings as never,
              });
            case 'reset-font-settings':
              return service.resetFontSettings.execute();
            case 'update-editor':
              return service.updateEditor.execute({
                editor: payload.editor as never,
              });
            case 'reset-editor':
              return service.resetEditor.execute();
            case 'set-shortcut':
              return service.setShortcut.execute({
                scope: payload.scope as ShortcutsScope,
                action: String(payload.action),
                binding: payload.binding as never,
              });
            case 'reset-shortcut':
              return service.resetShortcut.execute({
                scope: payload.scope as ShortcutsScope,
                action: String(payload.action),
              });
            case 'reset-all-shortcuts':
              return service.resetAllShortcuts.execute();
            case 'update-ai':
              return service.updateAI.execute({ ai: payload.ai as never });
            case 'reset-ai':
              return service.resetAI.execute();
            case 'set-ai-provider-key':
              return service.setAIProviderKey.execute({
                provider: payload.provider as AIProviderId,
                apiKey: String(payload.apiKey),
              });
            case 'delete-ai-provider-key':
              return service.deleteAIProviderKey.execute({
                provider: payload.provider as AIProviderId,
              });
            case 'update-meetings':
              return service.updateMeetings.execute({
                meetings: payload.meetings as never,
              });
            case 'reset-meetings':
              return service.resetMeetings.execute();
            case 'update-integrations':
              return service.updateIntegrations.execute({
                integrations: payload.integrations as never,
              });
            case 'update-onboarding':
              return service.updateOnboarding.execute({
                onboarding: payload.onboarding as never,
              });
            case 'reset-onboarding':
              return service.resetOnboarding.execute();
            case 'set-quick-capture-shortcut':
              return service.setQuickCaptureShortcut.execute({
                shortcut: String(payload.shortcut ?? ''),
              });
            default:
              return Effect.fail(new Error(`Unknown settings action: ${action}`));
          }
        });
        return result === undefined ? reply.status(204).send() : reply.send(result);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  }
}
