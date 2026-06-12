import { HardDrive } from '@phosphor-icons/react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { cn } from '@renderer/lib/utils';
import { MetricCard } from './MetricCard';

type Memory = NonNullable<ReturnType<typeof usePerformance>['memory']>;

export function MemoryMetricsSection({ memory }: { memory: Memory }) {
  const heapUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);

  return (
    <SettingsSection
      title="Memory Usage"
      description="Main process memory consumption"
      variant="sub"
    >
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
            'h-full transition-[width,background-color] duration-300 ease-out',
            heapUsagePercent < 70
              ? 'bg-green-500'
              : heapUsagePercent < 90
                ? 'bg-yellow-500'
                : 'bg-red-500',
          )}
          style={{ width: `${heapUsagePercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1 tabular-nums">
        <span>0 MB</span>
        <span>{Math.round(memory.heapTotal / 1024 / 1024)} MB</span>
      </div>
    </SettingsSection>
  );
}
