import { Effect, Fiber, TestClock, TestContext } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runJxaEffect,
} from '../../../../../src/main/adapters/out/integrations/osascriptJxa';
import type {
  CommandRunner,
} from '../../../../../src/main/adapters/out/integrations/commandRunner';
import { AppleCalendarSource } from '../../../../../src/main/adapters/out/integrations/AppleCalendarSource';

const originalPlatform = process.platform;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' });
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform });
  vi.restoreAllMocks();
});

describe('Effect command adapters', () => {
  it('parses injected JXA output without spawning a process', async () => {
    const commandRunner: CommandRunner = () =>
      Effect.succeed({ stdout: '{"unreadCount":4}', stderr: '' });

    await expect(
      Effect.runPromise(
        runJxaEffect<{ unreadCount: number }>('script', {
          target: 'Mail',
          timeoutMs: 100,
          commandRunner,
        }),
      ),
    ).resolves.toEqual({ ok: true, data: { unreadCount: 4 } });
  });

  it('maps Automation denial from the injected command failure', async () => {
    const commandRunner: CommandRunner = () =>
      Effect.fail(new Error('Not authorized to send Apple events (-1743)'));

    await expect(
      Effect.runPromise(
        runJxaEffect('script', {
          target: 'Mail',
          timeoutMs: 100,
          commandRunner,
        }),
      ),
    ).resolves.toMatchObject({ ok: false, reason: 'denied' });
  });

  it('interrupts a timed-out command under TestClock', async () => {
    let interrupted = false;
    const commandRunner: CommandRunner = () =>
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          }),
        ),
      );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(
          runJxaEffect('script', {
            target: 'Mail',
            timeoutMs: 100,
            commandRunner,
          }),
        );
        yield* TestClock.adjust(100);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );

    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
    expect(interrupted).toBe(true);
  });

  it('maps Calendar bridge JSON through an injected command runner', async () => {
    const commandRunner: CommandRunner = () =>
      Effect.succeed({
        stdout: JSON.stringify({
          status: 'connected',
          data: [{ id: 'cal-1', title: 'Work', source: 'iCloud' }],
        }),
        stderr: '',
      });
    const source = new AppleCalendarSource('/fake/bridge', Effect.runPromise, commandRunner);

    await expect(source.listCalendars()).resolves.toEqual({
      status: 'connected',
      data: [{ id: 'cal-1', title: 'Work', source: 'iCloud' }],
    });
  });
});
