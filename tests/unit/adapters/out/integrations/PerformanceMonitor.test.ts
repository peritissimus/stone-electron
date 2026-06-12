import { describe, expect, it, vi } from 'vitest';
import { PerformanceMonitor } from '../../../../../src/main/adapters/out/integrations/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  it('records startup phases and aggregates IPC and database metrics', () => {
    const monitor = new PerformanceMonitor();

    monitor.markStartupPhase('dbInitTime');
    monitor.markWindowReady();
    monitor.markStartupComplete();
    monitor.recordIPCCall('notes:get', 10, true);
    monitor.recordIPCCall('notes:get', 30, false);
    monitor.recordIPCCall('search:hybrid', 20, true);
    monitor.recordDBQuery('NoteRepository', 'findById', 50, true);
    monitor.recordDBQuery('NoteRepository', 'save', 150, false);

    const ipc = monitor.getIPCMetrics();
    const db = monitor.getDatabaseMetrics();
    const snapshot = monitor.getSnapshot();
    const startup = snapshot.startup;

    expect(startup.dbInitTime).toEqual(expect.any(Number));
    expect(startup.windowReadyTime).toEqual(expect.any(Number));
    expect(startup.totalStartupTime).toEqual(expect.any(Number));
    expect(ipc).toMatchObject({
      totalCalls: 3,
      totalErrors: 1,
      avgDurationMs: 20,
      p50DurationMs: 20,
      p95DurationMs: 30,
      p99DurationMs: 30,
    });
    expect(ipc.callsByChannel['notes:get']).toMatchObject({
      calls: 2,
      errors: 1,
      totalDurationMs: 40,
      avgDurationMs: 20,
      minDurationMs: 10,
      maxDurationMs: 30,
    });
    expect(db).toMatchObject({
      totalQueries: 2,
      totalErrors: 1,
      avgDurationMs: 100,
      slowQueries: 1,
    });
    expect(db.queriesByOperation['NoteRepository.save']).toMatchObject({
      count: 1,
      errors: 1,
      minDurationMs: 150,
      maxDurationMs: 150,
    });
    expect(snapshot).toMatchObject({
      startup: expect.objectContaining({ appStartTime: expect.any(Number) }),
      ipc: expect.objectContaining({ totalCalls: 3 }),
      database: expect.objectContaining({ totalQueries: 2 }),
    });
  });

  it('returns empty metrics after clearHistory', () => {
    const monitor = new PerformanceMonitor();

    monitor.recordIPCCall('notes:get', 10, true);
    monitor.recordDBQuery('NoteRepository', 'findById', 10, true);
    monitor.clearHistory();

    expect(monitor.getIPCMetrics()).toMatchObject({ totalCalls: 0, totalErrors: 0 });
    expect(monitor.getDatabaseMetrics()).toMatchObject({ totalQueries: 0, totalErrors: 0 });
  });

  it('reads renderer metrics from a live window and nulls destroyed or failing windows', async () => {
    const monitor = new PerformanceMonitor();
    const metrics = { fps: 60 };
    const liveWindow = {
      isDestroyed: () => false,
      webContents: { executeJavaScript: vi.fn().mockResolvedValue(metrics) },
    };
    const destroyedWindow = {
      isDestroyed: () => true,
      webContents: { executeJavaScript: vi.fn() },
    };
    const failingWindow = {
      isDestroyed: () => false,
      webContents: { executeJavaScript: vi.fn().mockRejectedValue(new Error('gone')) },
    };

    await expect(monitor.getRendererMetrics(liveWindow as any)).resolves.toBe(metrics);
    await expect(monitor.getRendererMetrics(destroyedWindow as any)).resolves.toBeNull();
    await expect(monitor.getRendererMetrics(failingWindow as any)).resolves.toBeNull();
    await expect(monitor.getRendererMetrics(null)).resolves.toBeNull();
  });
});
