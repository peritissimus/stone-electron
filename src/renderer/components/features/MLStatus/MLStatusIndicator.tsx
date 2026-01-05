/**
 * ML Status Indicator - Shows embedding service and operation status
 */

import { useEffect } from 'react';
import { Brain, CircleNotch, Check, Warning, Lightning } from 'phosphor-react';
import { cn } from '@renderer/lib/utils';
import { useMLStatusStore, subscribeToMLStatusEvents } from '@renderer/stores/mlStatusStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/base/ui/tooltip';

// Operation type labels for display
const OPERATION_LABELS: Record<string, string> = {
  'model-loading': 'Loading model',
  'classify-note': 'Classifying note',
  'classify-all': 'Classifying notes',
  'reclassify-all': 'Reclassifying all',
  'semantic-search': 'Searching',
  'compute-centroids': 'Computing centroids',
};

export function MLStatusIndicator() {
  const serviceState = useMLStatusStore((state) => state.serviceState);
  const currentOperation = useMLStatusStore((state) => state.currentOperation);
  const isInitializing = useMLStatusStore((state) => state.isInitializing);
  const isReady = useMLStatusStore((state) => state.isReady);
  const hasError = useMLStatusStore((state) => state.hasError);
  const isRunning = useMLStatusStore((state) => state.isRunning);
  const getProgressPercent = useMLStatusStore((state) => state.getProgressPercent);

  // Subscribe to ML status events on mount
  useEffect(() => {
    const unsubscribe = subscribeToMLStatusEvents();
    return () => unsubscribe();
  }, []);

  // Always show the indicator - provides visibility into ML status

  const progressPercent = getProgressPercent();

  // Determine icon and color based on state
  let icon: React.ReactNode;
  let statusColor: string;
  let statusText: string;

  if (isRunning()) {
    // Operation in progress
    icon = <CircleNotch size={14} className="animate-spin" />;
    statusColor = 'text-primary';
    const operationLabel = OPERATION_LABELS[currentOperation?.type || ''] || 'Processing';
    statusText = progressPercent !== null
      ? `${operationLabel} (${progressPercent}%)`
      : operationLabel;
  } else if (hasError()) {
    // Error state
    icon = <Warning size={14} />;
    statusColor = 'text-destructive';
    statusText = serviceState.error || 'Error';
  } else if (isInitializing()) {
    // Initializing
    icon = <CircleNotch size={14} className="animate-spin" />;
    statusColor = 'text-muted-foreground';
    statusText = 'Initializing ML...';
  } else if (isReady()) {
    // Ready state
    icon = <Brain size={14} />;
    statusColor = 'text-green-500';
    statusText = serviceState.model
      ? `ML Ready (${serviceState.model.name.split('/').pop()})`
      : 'ML Ready';
  } else {
    // Idle - not initialized yet
    icon = <Brain size={14} />;
    statusColor = 'text-muted-foreground';
    statusText = 'ML: Click Topics to initialize';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs border-t border-border',
              statusColor
            )}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="truncate">{statusText}</div>
              {/* Progress bar */}
              {isRunning() && progressPercent !== null && (
                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
              {/* Progress message */}
              {isRunning() && currentOperation?.progress?.message && (
                <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                  {currentOperation.progress.message}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <div className="text-xs space-y-1">
            <div className="font-medium">ML Service Status</div>
            <div>Status: {serviceState.status}</div>
            {serviceState.model && (
              <>
                <div>Model: {serviceState.model.name}</div>
                <div>Dimensions: {serviceState.model.dims}</div>
              </>
            )}
            {serviceState.error && (
              <div className="text-destructive">Error: {serviceState.error}</div>
            )}
            {currentOperation && (
              <>
                <div className="border-t border-border pt-1 mt-1">
                  Operation: {currentOperation.type}
                </div>
                {currentOperation.progress && (
                  <div>
                    Progress: {currentOperation.progress.current}/{currentOperation.progress.total}
                  </div>
                )}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
