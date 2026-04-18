import React from 'react';
import { cn } from '@renderer/lib/utils';

export type MetricStatus = 'good' | 'warning' | 'critical';

export interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  status?: MetricStatus;
  subtext?: string;
}

const statusColors: Record<MetricStatus, string> = {
  good: 'text-green-500',
  warning: 'text-yellow-500',
  critical: 'text-red-500',
};

export function MetricCard({
  icon,
  label,
  value,
  unit,
  status = 'good',
  subtext,
}: MetricCardProps) {
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
