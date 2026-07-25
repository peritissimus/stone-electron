import { Effect, Layer } from 'effect';
import {
  SystemBridgePort,
  SystemUseCasesPort,
  type ISystemUseCases,
} from '../../../domain';

export const SystemUseCasesLive = Layer.effect(
  SystemUseCasesPort,
  Effect.gen(function* () {
    const bridge = yield* SystemBridgePort;
    const service: ISystemUseCases = {
      getFonts: {
        execute: () =>
          bridge.getFonts().pipe(Effect.map((fonts) => ({ fonts }))),
      },
      selectFolder: {
        execute: (request) =>
          bridge
            .selectFolder(request)
            .pipe(Effect.map((folderPath) => ({ folderPath }))),
      },
      validatePath: {
        execute: ({ path }) =>
          bridge
            .validatePath(path)
            .pipe(Effect.map((isValid) => ({ isValid }))),
      },
      openInFolder: {
        execute: ({ path }) => bridge.showInFolder(path),
      },
      openExternal: {
        execute: ({ url }) => bridge.openExternal(url),
      },
      getMicAccessStatus: {
        execute: () =>
          bridge
            .getMicrophoneAccessStatus()
            .pipe(Effect.map((status) => ({ status }))),
      },
      requestMicAccess: {
        execute: () =>
          Effect.all(
            [
              bridge.askForMicrophoneAccess(),
              bridge.getMicrophoneAccessStatus(),
            ],
            { concurrency: 1 },
          ).pipe(
            Effect.map(([granted, status]) => ({ granted, status })),
          ),
      },
      getSystemAudioAccess: {
        execute: () =>
          bridge
            .getScreenCaptureAccessStatus()
            .pipe(Effect.map((status) => ({ status }))),
      },
      requestSystemAudioAccess: {
        execute: () =>
          bridge
            .getScreenCaptureAccessStatus()
            .pipe(Effect.map((status) => ({ status }))),
      },
    };
    return service;
  }),
);
