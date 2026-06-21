import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  SupervisedProcess,
  type SupervisableProcess,
} from '../../../src/main/shared/utils/SupervisedProcess';

/** Minimal fake that satisfies SupervisableProcess and lets tests emit exit. */
class FakeProc extends EventEmitter implements SupervisableProcess {
  killed = false;
  kill(): boolean {
    this.killed = true;
    this.emit('exit', null);
    return true;
  }
}

function makeSupervisor(overrides: {
  spawn?: () => SupervisableProcess | Promise<SupervisableProcess>;
  healthCheck?: () => Promise<void>;
  maxRestarts?: number;
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

    sup.markUnhealthy('wedged');
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
    sup.markUnhealthy('1');
    await sup.ensureReady();
    sup.markUnhealthy('2');
    await sup.ensureReady();
    sup.markUnhealthy('3');
    expect(spawn).toHaveBeenCalledTimes(3);

    // 4th attempt trips the breaker — fail fast, no new spawn.
    await expect(sup.ensureReady()).rejects.toThrow(/circuit open/);
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it('stop() clears circuit-breaker memory so a fresh start is allowed', async () => {
    const spawn = vi.fn(() => new FakeProc());
    const { sup } = makeSupervisor({ spawn, maxRestarts: 2 });

    await sup.ensureReady();
    sup.markUnhealthy('1');
    await sup.ensureReady();
    sup.markUnhealthy('2');
    await expect(sup.ensureReady()).rejects.toThrow(/circuit open/);

    sup.stop(); // resets the window
    await sup.ensureReady();
    expect(sup.isReady()).toBe(true);
  });
});
