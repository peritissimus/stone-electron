import { Effect, Layer } from 'effect';
import {
  FileStoragePort,
  PathServicePort,
  ScratchUseCasesPort,
  SystemBridgePort,
  type IScratchUseCases,
} from '../../../domain';

const MARKDOWN_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown']);

export const ScratchUseCasesLive = Layer.effect(
  ScratchUseCasesPort,
  Effect.gen(function* () {
    const fileStorage = yield* FileStoragePort;
    const systemBridge = yield* SystemBridgePort;
    const pathService = yield* PathServicePort;
    const resolveMarkdownPath = (path: string) =>
      Effect.gen(function* () {
        const absolute = (yield* pathService.isAbsolute(path))
          ? path
          : yield* pathService.resolve(path);
        const extension = (yield* pathService.extname(absolute)).toLowerCase();
        return yield* Effect.try({
          try: () => {
          if (!ALLOWED_EXTENSIONS.has(extension)) {
            throw new Error(
              `Unsupported file type for scratch editor: ${extension || '(none)'}`,
            );
          }
          return absolute;
          },
          catch: (error) =>
            error instanceof Error ? error : new Error(String(error)),
        });
      });
    const service: IScratchUseCases = {
      pickScratchFile: {
        execute: () =>
          systemBridge.selectFile({
            title: 'Open Markdown File',
            filters: MARKDOWN_FILTERS,
          }).pipe(
            Effect.map((selection) => ({
              path: Array.isArray(selection)
                ? selection[0] ?? null
                : selection ?? null,
            })),
          ),
      },
      readScratchFile: {
        execute: ({ path }) =>
          Effect.gen(function* () {
            const absolute = yield* resolveMarkdownPath(path);
            const info = yield* fileStorage.getFileInfo(absolute);
            if (!info || info.isDirectory) {
              return yield* Effect.fail(
                new Error(`File not found: ${absolute}`),
              );
            }
            if (info.size > MAX_FILE_BYTES) {
              return yield* Effect.fail(
                new Error(
                  `File too large for scratch editor: ${info.size} bytes (cap ${MAX_FILE_BYTES})`,
                ),
              );
            }
            return {
              path: absolute,
              name: yield* pathService.basename(absolute),
              content: (yield* fileStorage.read(absolute)) ?? '',
            };
          }),
      },
      writeScratchFile: {
        execute: ({ path, content }) =>
          Effect.gen(function* () {
            const absolute = yield* resolveMarkdownPath(path);
            if (!(yield* fileStorage.exists(absolute))) {
              return yield* Effect.fail(
                new Error(
                  `Refusing to create new file from scratch editor: ${absolute}`,
                ),
              );
            }
            yield* fileStorage.write(absolute, content);
            return { path: absolute };
          }),
      },
    };
    return service;
  }),
);
