/**
 * Performance Settings Component
 *
 * Displays comprehensive performance metrics for the application.
 * Can be used in Settings modal or as a standalone dashboard.
 */

import React from 'react';
import { Activity, Cpu, Database, HardDrive, Clock, Gauge, Timer } from 'phosphor-react';
import { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from './SettingsSection';
import { Label, Body, Heading4 } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { cn } from '@renderer/lib/utils';

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
  subtext?: string;
}

function MetricCard({ icon, label, value, unit, status = 'good', subtext }: MetricCardProps) {
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-red-500',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
      <div className={cn('p-2 rounded-md bg-secondary', statusColors[status])}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-lg font-semibold', statusColors[status])}>{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {subtext && <div className="text-xs text-muted-foreground truncate">{subtext}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Startup Metrics Section
// ============================================================================

function StartupMetricsSection({ startup }: { startup: NonNullable<ReturnType<typeof usePerformance>['startup']> }) {
  const phases = [
    { label: 'Database Init', value: startup.dbInitTime },
    { label: 'Container Init', value: startup.containerInitTime },
    { label: 'IPC Registration', value: startup.ipcRegistrationTime },
    { label: 'Window Creation', value: startup.windowCreationTime },
    { label: 'Window Ready', value: startup.windowReadyTime },
  ].filter((p) => p.value !== undefined);

  return (
    <SettingsSection title="Startup Performance">
      <Body className="text-muted-foreground text-sm mb-2">Time taken for each startup phase</Body>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Clock size={18} />}
          label="Total Startup Time"
          value={startup.totalStartupTime?.toFixed(0) ?? 'N/A'}
          unit="ms"
          status={
            (startup.totalStartupTime ?? 0) < 2000
              ? 'good'
              : (startup.totalStartupTime ?? 0) < 5000
                ? 'warning'
                : 'critical'
          }
        />
        {phases.map((phase) => (
          <div
            key={phase.label}
            className="flex justify-between items-center p-2 rounded bg-secondary/20"
          >
            <span className="text-xs text-muted-foreground">{phase.label}</span>
            <span className="text-sm font-medium">{phase.value?.toFixed(0)}ms</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

// ============================================================================
// Memory Metrics Section
// ============================================================================

function MemoryMetricsSection({ memory }: { memory: NonNullable<ReturnType<typeof usePerformance>['memory']> }) {
  const heapUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);

  return (
    <SettingsSection title="Memory Usage">
      <Body className="text-muted-foreground text-sm mb-2">Main process memory consumption</Body>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<HardDrive size={18} />}
          label="Heap Used"
          value={memory.heapUsedMB}
          unit="MB"
          status={heapUsagePercent < 70 ? 'good' : heapUsagePercent < 90 ? 'warning' : 'critical'}
          subtext={`${heapUsagePercent}% of heap`}
        />
        <MetricCard
          icon={<HardDrive size={18} />}
          label="RSS (Total)"
          value={memory.rssMB}
          unit="MB"
          status={memory.rssMB < 500 ? 'good' : memory.rssMB < 1000 ? 'warning' : 'critical'}
        />
      </div>
      <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            heapUsagePercent < 70
              ? 'bg-green-500'
              : heapUsagePercent < 90
                ? 'bg-yellow-500'
                : 'bg-red-500',
          )}
          style={{ width: `${heapUsagePercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>0 MB</span>
        <span>{Math.round(memory.heapTotal / 1024 / 1024)} MB</span>
      </div>
    </SettingsSection>
  );
}

// ============================================================================
// CPU Metrics Section
// ============================================================================

function CPUMetricsSection({
  cpu,
  eventLoop,
}: {
  cpu: NonNullable<ReturnType<typeof usePerformance>['cpu']>;
  eventLoop: NonNullable<ReturnType<typeof usePerformance>['eventLoop']>;
}) {
  return (
    <SettingsSection title="CPU & Event Loop">
      <Body className="text-muted-foreground text-sm mb-2">Process CPU usage and event loop health</Body>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Cpu size={18} />}
          label="CPU Usage"
          value={cpu.percentCPU}
          unit="%"
          status={cpu.percentCPU < 30 ? 'good' : cpu.percentCPU < 70 ? 'warning' : 'critical'}
        />
        <MetricCard
          icon={<Gauge size={18} />}
          label="Event Loop Lag"
          value={eventLoop.lagMs}
          unit="ms"
          status={eventLoop.lagMs < 10 ? 'good' : eventLoop.lagMs < 50 ? 'warning' : 'critical'}
        />
      </div>
    </SettingsSection>
  );
}

// ============================================================================
// IPC Metrics Section
// ============================================================================

function IPCMetricsSection({ ipc }: { ipc: NonNullable<ReturnType<typeof usePerformance>['ipc']> }) {
  const errorRate = ipc.totalCalls > 0 ? (ipc.totalErrors / ipc.totalCalls) * 100 : 0;

  // Get top 5 slowest channels
  const sortedChannels = Object.entries(ipc.callsByChannel)
    .sort(([, a], [, b]) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  return (
    <SettingsSection title="IPC Performance">
      <Body className="text-muted-foreground text-sm mb-2">Inter-process communication statistics</Body>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          icon={<Activity size={18} />}
          label="Total Calls"
          value={ipc.totalCalls}
          status="good"
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Avg Duration"
          value={ipc.avgDurationMs.toFixed(1)}
          unit="ms"
          status={ipc.avgDurationMs < 50 ? 'good' : ipc.avgDurationMs < 200 ? 'warning' : 'critical'}
        />
        <MetricCard
          icon={<Activity size={18} />}
          label="Error Rate"
          value={errorRate.toFixed(1)}
          unit="%"
          status={errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'critical'}
        />
      </div>

      {sortedChannels.length > 0 && (
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Slowest Channels</Label>
          <div className="space-y-1">
            {sortedChannels.map(([channel, stats]) => (
              <div
                key={channel}
                className="flex justify-between items-center p-2 rounded bg-secondary/20 text-xs"
              >
                <span className="font-mono truncate max-w-[200px]">{channel}</span>
                <span className="text-muted-foreground">
                  {stats.avgDurationMs.toFixed(1)}ms ({stats.calls} calls)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span>P50: {ipc.p50DurationMs.toFixed(1)}ms</span>
        <span>P95: {ipc.p95DurationMs.toFixed(1)}ms</span>
        <span>P99: {ipc.p99DurationMs.toFixed(1)}ms</span>
      </div>
    </SettingsSection>
  );
}

// ============================================================================
// Database Metrics Section
// ============================================================================

function DatabaseMetricsSection({ database }: { database: NonNullable<ReturnType<typeof usePerformance>['database']> }) {
  const errorRate = database.totalQueries > 0 ? (database.totalErrors / database.totalQueries) * 100 : 0;

  // Get top 5 slowest operations
  const sortedOps = Object.entries(database.queriesByOperation)
    .sort(([, a], [, b]) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  return (
    <SettingsSection title="Database Performance">
      <Body className="text-muted-foreground text-sm mb-2">Query execution statistics</Body>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Database size={18} />}
          label="Total Queries"
          value={database.totalQueries}
          status="good"
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Avg Query Time"
          value={database.avgDurationMs.toFixed(1)}
          unit="ms"
          status={database.avgDurationMs < 10 ? 'good' : database.avgDurationMs < 50 ? 'warning' : 'critical'}
        />
        <MetricCard
          icon={<Timer size={18} />}
          label="Slow Queries"
          value={database.slowQueries}
          subtext="> 100ms"
          status={database.slowQueries === 0 ? 'good' : database.slowQueries < 10 ? 'warning' : 'critical'}
        />
        <MetricCard
          icon={<Activity size={18} />}
          label="Error Rate"
          value={errorRate.toFixed(1)}
          unit="%"
          status={errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'critical'}
        />
      </div>

      {sortedOps.length > 0 && (
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Slowest Operations</Label>
          <div className="space-y-1">
            {sortedOps.map(([op, stats]) => (
              <div
                key={op}
                className="flex justify-between items-center p-2 rounded bg-secondary/20 text-xs"
              >
                <span className="font-mono truncate max-w-[200px]">{op}</span>
                <span className="text-muted-foreground">
                  {stats.avgDurationMs.toFixed(1)}ms ({stats.count} queries)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

// ============================================================================
// Renderer Metrics Section
// ============================================================================

function RendererMetricsSection({ renderer }: { renderer: NonNullable<ReturnType<typeof usePerformance>['renderer']> }) {
  if (!renderer) return null;

  const heapUsageMB = Math.round(renderer.memory.usedJSHeapSize / 1024 / 1024);
  const heapLimitMB = Math.round(renderer.memory.jsHeapSizeLimit / 1024 / 1024);
  const heapPercent = heapLimitMB > 0 ? Math.round((heapUsageMB / heapLimitMB) * 100) : 0;

  return (
    <SettingsSection title="Renderer Performance">
      <Body className="text-muted-foreground text-sm mb-2">Frontend JavaScript performance</Body>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Gauge size={18} />}
          label="FPS"
          value={renderer.fps ?? 'N/A'}
          status={
            renderer.fps === null ? 'good' : renderer.fps >= 55 ? 'good' : renderer.fps >= 30 ? 'warning' : 'critical'
          }
        />
        <MetricCard
          icon={<HardDrive size={18} />}
          label="JS Heap"
          value={heapUsageMB}
          unit="MB"
          status={heapPercent < 70 ? 'good' : heapPercent < 90 ? 'warning' : 'critical'}
          subtext={`${heapPercent}% of limit`}
        />
        <MetricCard
          icon={<Timer size={18} />}
          label="DOM Interactive"
          value={renderer.navigation.domInteractive.toFixed(0)}
          unit="ms"
          status={renderer.navigation.domInteractive < 1000 ? 'good' : renderer.navigation.domInteractive < 3000 ? 'warning' : 'critical'}
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Load Complete"
          value={renderer.navigation.loadComplete.toFixed(0)}
          unit="ms"
          status={renderer.navigation.loadComplete < 2000 ? 'good' : renderer.navigation.loadComplete < 5000 ? 'warning' : 'critical'}
        />
      </div>

      {renderer.longTasks.length > 0 && (
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Long Tasks ({renderer.longTasks.length})
          </Label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {renderer.longTasks.slice(-5).map((task, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-2 rounded bg-secondary/20 text-xs"
              >
                <span className="truncate max-w-[200px]">{task.name || 'anonymous'}</span>
                <span className="text-yellow-500">{task.duration.toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PerformanceSettings() {
  const {
    snapshot,
    loading,
    error,
    isPolling,
    memory,
    cpu,
    eventLoop,
    ipc,
    database,
    startup,
    renderer,
    uptime,
    fetchSnapshot,
    startPolling,
    stopPolling,
    clearHistory,
  } = usePerformance({ autoStart: true, pollInterval: 2000 });

  return (
    <ContainerStack className="gap-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <Heading4>Performance Monitor</Heading4>
          {uptime !== null && (
            <Body className="text-muted-foreground">
              App uptime: {Math.floor(uptime / 60)}m {Math.floor(uptime % 60)}s
            </Body>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={isPolling ? stopPolling : startPolling}
          >
            {isPolling ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchSnapshot} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            Clear History
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {loading && !snapshot && (
        <div className="flex items-center justify-center py-12">
          <Activity className="animate-spin" size={24} />
          <span className="ml-2">Loading performance data...</span>
        </div>
      )}

      {snapshot && (
        <>
          {/* Startup Metrics */}
          {startup && <StartupMetricsSection startup={startup} />}

          <Separator />

          {/* Memory Metrics */}
          {memory && <MemoryMetricsSection memory={memory} />}

          <Separator />

          {/* CPU & Event Loop */}
          {cpu && eventLoop && <CPUMetricsSection cpu={cpu} eventLoop={eventLoop} />}

          <Separator />

          {/* IPC Metrics */}
          {ipc && <IPCMetricsSection ipc={ipc} />}

          <Separator />

          {/* Database Metrics */}
          {database && <DatabaseMetricsSection database={database} />}

          <Separator />

          {/* Renderer Metrics */}
          {renderer && <RendererMetricsSection renderer={renderer} />}
        </>
      )}

      {/* Polling indicator */}
      {isPolling && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live monitoring active (updating every 2s)
        </div>
      )}
    </ContainerStack>
  );
}
