/**
 * Status Report IPC — exposes the weekly status generator.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { STATUS_REPORT_CHANNELS } from '@shared/constants/ipcChannels';
import { GenerateStatusReportRequestSchema } from '@shared/schemas';
import { handleIpcRequest } from '@main/shared/utils';
import type { IStatusReportUseCases } from '../../../domain';

export interface StatusReportIPCDeps {
  runStatusReportEffect: RunStatusReportEffect;
}

export type RunStatusReportEffect = <A, E>(
  use: (service: IStatusReportUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerStatusReportHandlers(deps: StatusReportIPCDeps): void {
  const run = deps.runStatusReportEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'StatusReportIPC',
      defaultCode: 'STATUS_REPORT_ERROR',
      context,
    });

  ipcMain.handle(STATUS_REPORT_CHANNELS.GENERATE, async (_event, rawRequest) => {
    const request = GenerateStatusReportRequestSchema.parse(rawRequest ?? {});
    return handleRequest(
      async () => run((service) => service.generate.execute(request)),
      { channel: STATUS_REPORT_CHANNELS.GENERATE, windowDays: request.windowDays },
    );
  });
}

export function unregisterStatusReportHandlers(): void {
  Object.values(STATUS_REPORT_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
