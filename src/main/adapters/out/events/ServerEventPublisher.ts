import { EventEmitter } from 'node:events';
import type { AppDomainEvent, EventHandler, IEventPublisher } from '../../../domain';

/**
 * In-process event publisher for the headless server.
 *
 * It deliberately has no Electron dependency. A future SSE or WebSocket
 * adapter can subscribe to this publisher without changing application code.
 */
export class ServerEventPublisher implements IEventPublisher {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(event: AppDomainEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  publishAll(events: AppDomainEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  subscribe<T extends AppDomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    const listener = (event: T) => {
      void handler(event);
    };
    this.emitter.on(eventType, listener);
    return () => this.emitter.off(eventType, listener);
  }

  subscribeAll(handler: EventHandler<AppDomainEvent>): () => void {
    const listener = (event: AppDomainEvent) => {
      void handler(event);
    };
    this.emitter.on('*', listener);
    return () => this.emitter.off('*', listener);
  }
}
