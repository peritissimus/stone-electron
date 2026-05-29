import { Clock, Gauge, HardDrive, Timer } from 'phosphor-react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { Label } from '@renderer/components/base/ui/text';
import { MetricCard } from './MetricCard';

type Renderer = NonNullable<ReturnType<typeof usePerformance>['renderer']>;

export function RendererMetricsSection({ renderer }: { renderer: Renderer }) {
  if (!renderer) return null;

  const heapUsageMB = Math.round(renderer.memory.usedJSHeapSize / 1024 / 1024);
  const heapLimitMB = Math.round(renderer.memory.jsHeapSizeLimit / 1024 / 1024);
  const heapPercent = heapLimitMB > 0 ? Math.round((heapUsageMB / heapLimitMB) * 100) : 0;

  return (
    <SettingsSection
      title="Renderer Performance"
      description="Frontend JavaScript performance"
      variant="sub"
    >
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Gauge size={18} />}
          label="FPS"
          value={renderer.fps ?? 'N/A'}
          status={
            renderer.fps === null
              ? 'good'
              : renderer.fps >= 55
                ? 'good'
                : renderer.fps >= 30
                  ? 'warning'
                  : 'critical'
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
          status={
            renderer.navigation.domInteractive < 1000
              ? 'good'
              : renderer.navigation.domInteractive < 3000
                ? 'warning'
                : 'critical'
          }
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Load Complete"
          value={renderer.navigation.loadComplete.toFixed(0)}
          unit="ms"
          status={
            renderer.navigation.loadComplete < 2000
              ? 'good'
              : renderer.navigation.loadComplete < 5000
                ? 'warning'
                : 'critical'
          }
        />
      </div>

      {renderer.longTasks.length > 0 && (
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Long Tasks ({renderer.longTasks.length})
          </Label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {renderer.longTasks.slice(-5).map((task) => (
              <div
                key={task.startTime}
                className="flex justify-between items-center p-2 rounded bg-secondary/20 text-xs"
              >
                <span className="truncate max-w-[200px]">{task.name || 'anonymous'}</span>
                <span className="text-yellow-500 tabular-nums">{task.duration.toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
