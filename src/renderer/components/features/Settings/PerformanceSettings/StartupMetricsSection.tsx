import { Clock } from 'phosphor-react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { Body } from '@renderer/components/base/ui/text';
import { MetricCard } from './MetricCard';

type Startup = NonNullable<ReturnType<typeof usePerformance>['startup']>;

export function StartupMetricsSection({ startup }: { startup: Startup }) {
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
