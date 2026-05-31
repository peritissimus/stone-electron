/**
 * Status Report IPC — exposes the weekly status generator.
 */

import { ipcMain } from 'electron';
import { STATUS_REPORT_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { IStatusReportUseCases } from '../../../domain';

export interface StatusReportIPCDeps {
  statusReportUseCases: IStatusReportUseCases;
}

export function registerStatusReportHandlers(deps: StatusReportIPCDeps): void {
  const { statusReportUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'StatusReportIPC',
      defaultCode: 'STATUS_REPORT_ERROR',
      context,
    });

  ipcMain.handle(STATUS_REPORT_CHANNELS.GENERATE, async (_event, request) =>
    handleRequest(
      async () =>
        statusReportUseCases.generate.execute({
          workspaceId: request?.workspaceId,
          windowDays: request?.windowDays,
          promptTemplate: request?.promptTemplate,
        }),
      { channel: STATUS_REPORT_CHANNELS.GENERATE, windowDays: request?.windowDays },
    ),
  );
}

export function unregisterStatusReportHandlers(): void {
  Object.values(STATUS_REPORT_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
