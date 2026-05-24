import { Activity, Clock, Database, Timer } from 'phosphor-react';
import type { usePerformance } from '@renderer/hooks/usePerformance';
import { SettingsSection } from '../SettingsSection';
import { Label } from '@renderer/components/base/ui/text';
import { MetricCard } from './MetricCard';

type DatabaseMetrics = NonNullable<ReturnType<typeof usePerformance>['database']>;

export function DatabaseMetricsSection({ database }: { database: DatabaseMetrics }) {
  const errorRate =
    database.totalQueries > 0 ? (database.totalErrors / database.totalQueries) * 100 : 0;

  const sortedOps = Object.entries(database.queriesByOperation)
    .sort(([, a], [, b]) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  return (
    <SettingsSection
      title="Database Performance"
      description="Query execution statistics"
      variant="sub"
    >
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
          status={
            database.avgDurationMs < 10
              ? 'good'
              : database.avgDurationMs < 50
                ? 'warning'
                : 'critical'
          }
        />
        <MetricCard
          icon={<Timer size={18} />}
          label="Slow Queries"
          value={database.slowQueries}
          subtext="> 100ms"
          status={
            database.slowQueries === 0
              ? 'good'
              : database.slowQueries < 10
                ? 'warning'
                : 'critical'
          }
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
                <span className="text-muted-foreground tabular-nums">
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
