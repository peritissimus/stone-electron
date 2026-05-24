import { Activity } from 'phosphor-react';
import { usePerformance } from '@renderer/hooks/usePerformance';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { cn } from '@renderer/lib/utils';
import { SettingsSection } from '../SettingsSection';
import { StartupMetricsSection } from './StartupMetricsSection';
import { MemoryMetricsSection } from './MemoryMetricsSection';
import { CPUMetricsSection } from './CPUMetricsSection';
import { IPCMetricsSection } from './IPCMetricsSection';
import { DatabaseMetricsSection } from './DatabaseMetricsSection';
import { RendererMetricsSection } from './RendererMetricsSection';

function formatUptime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

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

  const description =
    uptime !== null ? `App uptime ${formatUptime(uptime)} · sampling every 2s` : undefined;

  return (
    <SettingsSection
      title="Performance Monitor"
      description={description}
      action={
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
              isPolling
                ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'border-border bg-muted/50 text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isPolling ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/60',
              )}
              aria-hidden
            />
            {isPolling ? 'Live' : 'Paused'}
          </div>
          <Button variant="outline" size="sm" onClick={isPolling ? stopPolling : startPolling}>
            {isPolling ? 'Pause' : 'Resume'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchSnapshot} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            Clear
          </Button>
        </div>
      }
    >
      <ContainerStack className="gap-6">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {loading && !snapshot && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Activity className="animate-spin" size={20} />
            <span className="ml-2 text-sm">Loading performance data…</span>
          </div>
        )}

        {snapshot && (
          <>
            {startup && <StartupMetricsSection startup={startup} />}
            <Separator />
            {memory && <MemoryMetricsSection memory={memory} />}
            <Separator />
            {cpu && eventLoop && <CPUMetricsSection cpu={cpu} eventLoop={eventLoop} />}
            <Separator />
            {ipc && <IPCMetricsSection ipc={ipc} />}
            <Separator />
            {database && <DatabaseMetricsSection database={database} />}
            <Separator />
            {renderer && <RendererMetricsSection renderer={renderer} />}
          </>
        )}
      </ContainerStack>
    </SettingsSection>
  );
}
