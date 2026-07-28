import type { FastifyInstance } from 'fastify';
import type { AppDomainEvent, IEventPublisher } from '../../../domain';
import { DOMAIN_TO_IPC_EVENT } from '../../out/events/domainEventChannels';

interface EventStreamHTTPDeps {
  eventPublisher: IEventPublisher;
}

/**
 * Server-sent events for the push half of the transport.
 *
 * Electron delivers domain events to renderers over `webContents.send`; a
 * browser gets the same events on one long-lived stream, keyed by the same
 * channel names, so every tab stays live and multiple tabs stay in step.
 */
export class EventStreamHTTP {
  constructor(private readonly deps: EventStreamHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/events', (request, reply) => {
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        // Proxies that buffer would defeat the point of a stream.
        'x-accel-buffering': 'no',
      });
      reply.raw.write('retry: 3000\n\n');

      const send = (event: AppDomainEvent) => {
        const channel = DOMAIN_TO_IPC_EVENT[event.type];
        if (!channel) return;
        try {
          reply.raw.write(`data: ${JSON.stringify({ channel, payload: event.payload })}\n\n`);
        } catch (error) {
          request.log.warn({ err: error }, 'Dropping event for a closed stream');
        }
      };

      const unsubscribe = this.deps.eventPublisher.subscribeAll(send);

      // Keeps intermediaries from reaping an idle connection.
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(': ping\n\n');
        } catch {
          /* the close handler cleans up */
        }
      }, 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.raw.on('close', close);
      request.raw.on('error', close);
    });
  }
}
