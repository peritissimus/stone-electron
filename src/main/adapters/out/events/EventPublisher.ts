/**
 * Event Publisher Adapter
 *
 * Implements IEventPublisher port using Node's EventEmitter.
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import type { IEventPublisher, AppDomainEvent, EventHandler } from '../../../domain';
import { DOMAIN_TO_IPC_EVENT } from './domainEventChannels';

// Singleton event emitter
const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);


export class EventPublisher implements IEventPublisher {
  constructor(
    private readonly getAllWindows: typeof BrowserWindow.getAllWindows = () =>
      BrowserWindow.getAllWindows(),
  ) {}

  publish(event: AppDomainEvent): void {
    eventEmitter.emit(event.type, event.payload);

    const ipcChannel = DOMAIN_TO_IPC_EVENT[event.type];
    if (ipcChannel) {
      this.broadcastToRenderer(ipcChannel, event.payload);
    }
  }

  publishAll(events: AppDomainEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  subscribe<T extends AppDomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    const wrappedHandler = (payload: unknown) => {
      const event = {
        type: eventType,
        timestamp: new Date(),
        payload,
      } as T;
      handler(event);
    };

    eventEmitter.on(eventType, wrappedHandler);

    return () => {
      eventEmitter.off(eventType, wrappedHandler);
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
      'settings:changed',
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

  private broadcastToRenderer(channel: string, payload: unknown): void {
    try {
      const windows = this.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, payload);
        }
      }
    } catch {
      // Ignore errors when broadcasting (window may be closed)
    }
  }
}
