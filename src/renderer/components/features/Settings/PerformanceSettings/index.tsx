import { Activity } from 'phosphor-react';
import { usePerformance } from '@renderer/hooks/usePerformance';
import { Body, Heading4 } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { StartupMetricsSection } from './StartupMetricsSection';
import { MemoryMetricsSection } from './MemoryMetricsSection';
import { CPUMetricsSection } from './CPUMetricsSection';
import { IPCMetricsSection } from './IPCMetricsSection';
import { DatabaseMetricsSection } from './DatabaseMetricsSection';
import { RendererMetricsSection } from './RendererMetricsSection';

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
          <Button variant="outline" size="sm" onClick={isPolling ? stopPolling : startPolling}>
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

      {isPolling && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live monitoring active (updating every 2s)
        </div>
      )}
    </ContainerStack>
  );
}
