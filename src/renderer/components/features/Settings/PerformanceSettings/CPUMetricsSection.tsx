import { Cpu, Gauge } from 'phosphor-react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { Body } from '@renderer/components/base/ui/text';
import { MetricCard } from './MetricCard';

type CPU = NonNullable<ReturnType<typeof usePerformance>['cpu']>;
type EventLoop = NonNullable<ReturnType<typeof usePerformance>['eventLoop']>;

export function CPUMetricsSection({ cpu, eventLoop }: { cpu: CPU; eventLoop: EventLoop }) {
  return (
    <SettingsSection title="CPU & Event Loop">
      <Body className="text-muted-foreground text-sm mb-2">
        Process CPU usage and event loop health
      </Body>
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
