import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  SupervisedProcess,
  type SupervisableProcess,
} from '../../../src/main/shared/utils/SupervisedProcess';

/** Minimal fake that satisfies SupervisableProcess and lets tests emit exit. */
class FakeProc extends EventEmitter implements SupervisableProcess {
  killed = false;
  signals: NodeJS.Signals[] = [];
  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true;
    this.signals.push(signal);
    this.emit('exit', null);
    return true;
  }
}

class StubbornProc extends FakeProc {
  override kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true;
    this.signals.push(signal);
    if (signal === 'SIGKILL') this.emit('exit', null);
    return true;
  }
}

function makeSupervisor(overrides: {
  spawn?: () => SupervisableProcess | Promise<SupervisableProcess>;
  healthCheck?: () => Promise<void>;
  maxRestarts?: number;
  terminationGraceMs?: number;
}) {
  const spawned: FakeProc[] = [];
  const sup = new SupervisedProcess({
    name: 'test',
    spawn:
      overrides.spawn ??
      (() => {
        const p = new FakeProc();
        spawned.push(p);
        return p;
      }),
    healthCheck: overrides.healthCheck ?? (() => Promise.resolve()),
    healthCheckTimeoutMs: 100,
    maxRestarts: overrides.maxRestarts ?? 5,
    restartWindowMs: 10_000,
    backoffBaseMs: 1, // keep tests fast
    backoffMaxMs: 2,
    terminationGraceMs: overrides.terminationGraceMs ?? 5,
  });
  return { sup, spawned };
}

describe('SupervisedProcess', () => {
  it('spawns once and becomes ready after a passing health check', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn });

    expect(sup.isReady()).toBe(false);
    await sup.ensureReady();
    expect(sup.isReady()).toBe(true);

    // Already ready → no second spawn.
    await sup.ensureReady();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight start across concurrent callers', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn });

    await Promise.all([sup.ensureReady(), sup.ensureReady(), sup.ensureReady()]);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('kills the process and fails start when the health check times out', async () => {
    const proc = new FakeProc();
    const { sup } = makeSupervisor({
      spawn: () => proc,
      healthCheck: () => new Promise(() => {}), // never resolves
    });

    await expect(sup.ensureReady()).rejects.toThrow(/health check timed out/);
    expect(proc.killed).toBe(true);
    expect(sup.isReady()).toBe(false);
  });

  it('respawns after markUnhealthy', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn });

    await sup.ensureReady();
    expect(spawn).toHaveBeenCalledTimes(1);

    await sup.markUnhealthy('wedged');
    expect(sup.isReady()).toBe(false);

    await sup.ensureReady();
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(sup.isReady()).toBe(true);
  });

  it('opens the circuit breaker after too many spawns and refuses to relaunch', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn, maxRestarts: 3 });

    // 3 spawn attempts allowed within the window.
    await sup.ensureReady();
    await sup.markUnhealthy('1');
    await sup.ensureReady();
    await sup.markUnhealthy('2');
    await sup.ensureReady();
    await sup.markUnhealthy('3');
    expect(spawn).toHaveBeenCalledTimes(3);

    // 4th attempt trips the breaker — fail fast, no new spawn.
    await expect(sup.ensureReady()).rejects.toThrow(/circuit open/);
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it('stop() clears circuit-breaker memory so a fresh start is allowed', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn, maxRestarts: 2 });

    await sup.ensureReady();
    await sup.markUnhealthy('1');
    await sup.ensureReady();
    await sup.markUnhealthy('2');
    await expect(sup.ensureReady()).rejects.toThrow(/circuit open/);

    await sup.stop(); // resets the window
    await sup.ensureReady();
    expect(sup.isReady()).toBe(true);
  });

  it('escalates to SIGKILL and waits for exit before respawning', async () => {
    const first = new StubbornProc();
    const second = new FakeProc();
    const spawn = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { sup } = makeSupervisor({ spawn, terminationGraceMs: 5 });

    await sup.ensureReady();
    const stopping = sup.markUnhealthy('wedged');
    await expect(stopping).resolves.toBeUndefined();
    expect(first.signals).toEqual(['SIGTERM', 'SIGKILL']);

    await sup.ensureReady();
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(sup.isReady()).toBe(true);
  });

  it('kills a process that finishes spawning while stop is in progress', async () => {
    const proc = new FakeProc();
    let releaseSpawn!: () => void;
    const spawnGate = new Promise<void>((resolve) => {
      releaseSpawn = resolve;
    });
    const { sup } = makeSupervisor({
      spawn: async () => {
        await spawnGate;
        return proc;
      },
    });

    const starting = sup.ensureReady();
    const stopping = sup.stop();
    releaseSpawn();

    await expect(starting).rejects.toThrow('start cancelled');
    await stopping;
    expect(proc.signals).toEqual(['SIGTERM']);
    expect(sup.isReady()).toBe(false);
  });
});
