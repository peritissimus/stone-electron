import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../../../../src/shared/constants/ipcChannels';

const getAllWindows = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows },
}));

describe('EventPublisher', () => {
  beforeEach(() => {
    getAllWindows.mockReset();
  });

  it('publishes subscribed domain events and supports unsubscribe', async () => {
    const { EventPublisher } = await import(
      '../../../../../src/main/adapters/out/events/EventPublisher'
    );
    const publisher = new EventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.subscribe('note:created', handler);

    publisher.publish({
      type: 'note:created',
      timestamp: new Date('2026-04-21T10:00:00'),
      payload: { id: 'note-1' },
    });
    unsubscribe();
    publisher.publish({
      type: 'note:created',
      timestamp: new Date('2026-04-21T10:01:00'),
      payload: { id: 'note-2' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note:created',
        payload: { id: 'note-1' },
      }),
    );
  });

  it('broadcasts mapped events to live renderer windows', async () => {
    const send = vi.fn();
    getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send } },
      { isDestroyed: () => true, webContents: { send: vi.fn() } },
    ]);
    const { EventPublisher } = await import(
      '../../../../../src/main/adapters/out/events/EventPublisher'
    );

    new EventPublisher().publish({
      type: 'workspace:activated',
      timestamp: new Date('2026-04-21T10:00:00'),
      payload: { id: 'ws-1', name: 'Stone', folderPath: '/tmp/stone' },
    });

    expect(send).toHaveBeenCalledWith(EVENTS.WORKSPACE_SWITCHED, {
      id: 'ws-1',
      name: 'Stone',
      folderPath: '/tmp/stone',
    });
  });

  it('subscribeAll wires multiple event types and unwires them together', async () => {
    const { EventPublisher } = await import(
      '../../../../../src/main/adapters/out/events/EventPublisher'
    );
    const publisher = new EventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.subscribeAll(handler);

    publisher.publishAll([
      { type: 'tag:created', timestamp: new Date(), payload: { tag: { id: 'tag-1' } } },
      { type: 'topic:deleted', timestamp: new Date(), payload: { id: 'topic-1' } },
    ]);
    unsubscribe();
    publisher.publish({
      type: 'tag:created',
      timestamp: new Date(),
      payload: { tag: { id: 'tag-2' } },
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
