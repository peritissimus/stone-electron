import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export function publishAppearanceChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'appearance' },
  });
}
