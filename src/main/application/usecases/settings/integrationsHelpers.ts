import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IntegrationsConfig } from '../../../domain/value-objects/AppConfig';

export function publishIntegrationsChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'integrations' },
  });
}

export function mergeIntegrationsPatch(
  current: IntegrationsConfig,
  patch: Partial<IntegrationsConfig>,
): IntegrationsConfig {
  return {
    linearApiKey:
      patch.linearApiKey === undefined ? current.linearApiKey : patch.linearApiKey.trim(),
    selectedCalendarIds:
      patch.selectedCalendarIds === undefined
        ? current.selectedCalendarIds
        : patch.selectedCalendarIds === null
          ? null
          : [...new Set(patch.selectedCalendarIds.map((id) => id.trim()).filter(Boolean))],
  };
}
