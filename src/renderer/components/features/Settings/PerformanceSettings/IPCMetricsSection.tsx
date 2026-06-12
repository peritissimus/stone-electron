import { Pulse, Clock } from '@phosphor-icons/react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { Label } from '@renderer/components/base/ui/text';
import { MetricCard } from './MetricCard';

type IPC = NonNullable<ReturnType<typeof usePerformance>['ipc']>;

export function IPCMetricsSection({ ipc }: { ipc: IPC }) {
  const errorRate = ipc.totalCalls > 0 ? (ipc.totalErrors / ipc.totalCalls) * 100 : 0;

  const sortedChannels = Object.entries(ipc.callsByChannel)
    .sort(([, a], [, b]) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  return (
    <SettingsSection
      title="IPC Performance"
      description="Inter-process communication statistics"
      variant="sub"
    >
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          icon={<Pulse size={18} />}
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
          icon={<Pulse size={18} />}
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
                <span className="text-muted-foreground tabular-nums">
                  {stats.avgDurationMs.toFixed(1)}ms ({stats.calls} calls)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-muted-foreground tabular-nums">
        <span>P50: {ipc.p50DurationMs.toFixed(1)}ms</span>
        <span>P95: {ipc.p95DurationMs.toFixed(1)}ms</span>
        <span>P99: {ipc.p99DurationMs.toFixed(1)}ms</span>
      </div>
    </SettingsSection>
  );
}
