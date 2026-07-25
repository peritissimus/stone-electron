/**
 * System IPC Adapter - Handles system-level IPC channels
 *
 * Return types are bound to shared wire schemas (src/shared/schemas/system.ts).
 * If the handler drifts from the renderer's expected shape, TypeScript fails
 * at compile time.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import type { SystemGetFontsResponse } from '@shared/schemas';
import { z } from '@shared/schemas/schema';
import type { ISystemUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SystemIPCDeps {
  runSystemEffect: RunSystemEffect;
}

export type RunSystemEffect = <A, E>(
  use: (service: ISystemUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerSystemHandlers(deps: SystemIPCDeps): void {
  const run = deps.runSystemEffect;

  ipcMain.handle(SYSTEM_CHANNELS.GET_FONTS, async () => {
    return handleIpcRequest<SystemGetFontsResponse>(
      async () => {
        return await run((service) => service.getFonts.execute());
      },
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.GET_FONTS },
      },
    );
  });

  ipcMain.handle(SYSTEM_CHANNELS.GET_MIC_ACCESS_STATUS, async () => {
    return handleIpcRequest(
      async () => run((service) => service.getMicAccessStatus.execute()),
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.GET_MIC_ACCESS_STATUS },
      },
    );
  });

  ipcMain.handle(SYSTEM_CHANNELS.REQUEST_MIC_ACCESS, async () => {
    return handleIpcRequest(
      async () => run((service) => service.requestMicAccess.execute()),
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.REQUEST_MIC_ACCESS },
      },
    );
  });

  ipcMain.handle(SYSTEM_CHANNELS.GET_SYSTEM_AUDIO_ACCESS, async () => {
    return handleIpcRequest(
      async () => run((service) => service.getSystemAudioAccess.execute()),
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.GET_SYSTEM_AUDIO_ACCESS },
      },
    );
  });

  ipcMain.handle(SYSTEM_CHANNELS.REQUEST_SYSTEM_AUDIO_ACCESS, async () => {
    return handleIpcRequest(
      async () =>
        run((service) => service.requestSystemAudioAccess.execute()),
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.REQUEST_SYSTEM_AUDIO_ACCESS },
      },
    );
  });

  // Renderer-initiated external opens are scheme-allowlisted: web links and
  // the macOS System Settings deep links only — never arbitrary protocols.
  const OpenExternalRequestSchema = z.object({
    url: z
      .string()
      .refine(
        (u) => u.startsWith('https://') || u.startsWith('x-apple.systempreferences:'),
        'URL scheme not allowed',
      ),
  });

  ipcMain.handle(SYSTEM_CHANNELS.OPEN_EXTERNAL, async (_event, rawRequest) => {
    const request = OpenExternalRequestSchema.parse(rawRequest);
    return handleIpcRequest(
      async () =>
        run((service) => service.openExternal.execute({ url: request.url })),
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.OPEN_EXTERNAL, url: request.url },
      },
    );
  });

  logger.info('[IPC] System handlers registered');
}

export function unregisterSystemHandlers(): void {
  Object.values(SYSTEM_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
