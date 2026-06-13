import { beforeEach, describe, expect, it, vi } from 'vitest';

const processMock = vi.hoisted(() => {
  class MiniEmitter {
    handlers = new Map<string, Array<(...args: any[]) => void>>();
    on(event: string, callback: (...args: any[]) => void) {
      const current = this.handlers.get(event) ?? [];
      current.push(callback);
      this.handlers.set(event, current);
      return this;
    }
    once(event: string, callback: (...args: any[]) => void) {
      const wrapped = (...args: any[]) => {
        this.handlers.set(
          event,
          (this.handlers.get(event) ?? []).filter((item) => item !== wrapped),
        );
        callback(...args);
      };
      return this.on(event, wrapped);
    }
    emit(event: string, ...args: any[]) {
      for (const callback of this.handlers.get(event) ?? []) {
        callback(...args);
      }
    }
    removeAllListeners(event?: string) {
      if (event) this.handlers.delete(event);
      else this.handlers.clear();
      return this;
    }
  }

  class MockChild extends MiniEmitter {
    stdout = new MiniEmitter();
    stderr = new MiniEmitter();
    kill = vi.fn();
  }

  return {
    children: [] as MockChild[],
    spawn: vi.fn(() => {
      const child = new MockChild();
      processMock.children.push(child);
      return child;
    }),
    execFile: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  spawn: processMock.spawn,
  execFile: processMock.execFile,
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

async function loadSystemAudioTap(platform: NodeJS.Platform) {
  vi.resetModules();
  setPlatform(platform);
  const { SystemAudioTap } = await import('../../../../../src/main/adapters/out/integrations/SystemAudioTap');
  return new SystemAudioTap();
}

describe('SystemAudioTap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processMock.children.length = 0;
    processMock.execFile.mockImplementation((_file, _args, _options, callback) => {
      callback(null, '{"permission":"granted"}');
    });
  });

  it('reports unsupported and refuses to start outside macOS', async () => {
    const tap = await loadSystemAudioTap('linux');

    expect(tap.isSupported()).toBe(false);
    await expect(tap.checkPermission()).resolves.toBe('unsupported');
    await expect(tap.requestPermission()).resolves.toBe('unsupported');
    await expect(tap.start('rec-1', '/tmp/audio.raw')).rejects.toThrow('only supported on macOS');
  });

  it('checks permission through the helper on macOS', async () => {
    const tap = await loadSystemAudioTap('darwin');

    await expect(tap.checkPermission()).resolves.toBe('granted');

    processMock.execFile.mockImplementationOnce((_file, _args, _options, callback) => {
      callback(null, '{"permission":"denied"}');
    });
    await expect(tap.requestPermission()).resolves.toBe('denied');

    processMock.execFile.mockImplementationOnce((_file, _args, _options, callback) => {
      callback(new Error('missing'), '');
    });
    await expect(tap.checkPermission()).resolves.toBe('unsupported');
  });

  it('starts, ignores duplicate starts, and stops a helper session', async () => {
    const tap = await loadSystemAudioTap('darwin');

    const start = tap.start('rec-1', '/tmp/audio.raw');
    const child = processMock.children[0];
    // Helper emits newline-delimited JSON; readiness is one line.
    child.stdout.emit('data', '{"recording":true}\n');
    await start;

    await tap.start('rec-1', '/tmp/audio.raw');
    expect(processMock.spawn).toHaveBeenCalledTimes(1);
    expect(processMock.spawn).toHaveBeenCalledWith(
      expect.stringContaining('native/bin/stone-audio-tap'),
      ['record', '/tmp/audio.raw'],
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );

    const stop = tap.stop('rec-1');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.emit('exit', 0);
    await stop;

    await tap.stop('rec-1');
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('parses the helper level stream and forwards peaks to onLevel listeners', async () => {
    const tap = await loadSystemAudioTap('darwin');
    const levels: Array<{ id: string; level: number }> = [];
    tap.onLevel((id, level) => levels.push({ id, level }));

    const start = tap.start('rec-lvl', '/tmp/audio.raw');
    const child = processMock.children[0];
    child.stdout.emit('data', '{"recording":true}\n');
    await start;

    // Multiple level lines may arrive in one chunk, plus a partial line that
    // completes on the next chunk — the parser must handle both.
    child.stdout.emit('data', '{"level":0.250}\n{"level":0.5');
    child.stdout.emit('data', '00}\n');
    // Session end zeroes the meter.
    child.emit('exit', 0);

    expect(levels).toEqual([
      { id: 'rec-lvl', level: 0.25 },
      { id: 'rec-lvl', level: 0.5 },
      { id: 'rec-lvl', level: 0 },
    ]);
  });

  it('rejects when the helper exits before reporting readiness', async () => {
    const tap = await loadSystemAudioTap('darwin');

    const start = tap.start('rec-2', '/tmp/audio.raw');
    const child = processMock.children[0];
    child.stderr.emit('data', 'boom');
    child.emit('exit', 2);

    await expect(start).rejects.toThrow('boom');
  });
});
