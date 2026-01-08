/**
 * Event Publisher Adapter
 *
 * Implements IEventPublisher port using an in-process event bus.
 */

import type {
  IEventPublisher,
  AppDomainEvent,
  EventHandler,
} from '../../../domain/ports/out/IEventPublisher';
import { getEventBus } from '@main/services/EventBus';

export class EventPublisher implements IEventPublisher {
  private readonly eventBus = getEventBus();

  publish(event: AppDomainEvent): void {
    this.eventBus.emit(event.type, event.payload);
  }

  publishAll(events: AppDomainEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  subscribe<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): () => void {
    const wrappedHandler = (payload: unknown) => {
      const event = {
        type: eventType,
        timestamp: new Date(),
        payload,
      } as T;
      handler(event);
    };

    this.eventBus.on(eventType, wrappedHandler as any);

    return () => {
      this.eventBus.off(eventType, wrappedHandler as any);
    };
  }

  subscribeAll(handler: EventHandler<AppDomainEvent>): () => void {
    const eventTypes: AppDomainEvent['type'][] = [
      'note:created',
      'note:updated',
      'note:deleted',
      'note:moved',
      'notebook:created',
      'notebook:updated',
      'notebook:deleted',
      'tag:created',
      'tag:deleted',
      'note:tagged',
      'note:untagged',
      'workspace:activated',
      'file:synced',
      'topic:created',
      'topic:updated',
      'topic:deleted',
      'note:classified',
      'embedding:progress',
      'db:vacuum:progress',
      'db:vacuum:complete',
    ];

    const unsubscribers: Array<() => void> = [];

    for (const eventType of eventTypes) {
      const unsubscribe = this.subscribe(eventType, handler as EventHandler<any>);
      unsubscribers.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }
}
