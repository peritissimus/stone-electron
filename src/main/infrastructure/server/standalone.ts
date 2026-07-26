import path from 'node:path';
import { createDatabaseManager } from '../database/DatabaseManager';
import { createNoteServerRuntime } from '../di/noteServerRuntime';
import { createNoteHttpServer } from './noteHttpServer';

const dataDir = path.resolve(process.env.STONE_DATA_DIR ?? path.join(process.cwd(), 'data'));
process.env.DATABASE_URL ??= path.join(dataDir, 'notes.db');

const workspacePath = process.env.STONE_WORKSPACE_PATH ?? path.join(dataDir, 'workspace');
const configPath = process.env.STONE_CONFIG_PATH ?? path.join(dataDir, 'config.json');
process.env.STONE_CONFIG_PATH ??= configPath;
const staticDir = process.env.STONE_WEB_DIST ?? path.join(process.cwd(), 'dist', 'web');
// The embedding model cache is shared with the desktop app when both point at
// the same config directory, so the model is downloaded at most once.
const mlCacheDir =
  process.env.STONE_ML_CACHE_DIR ?? path.join(path.dirname(path.resolve(configPath)), 'ml-cache');
const embeddingWorkerPath =
  process.env.STONE_EMBEDDING_WORKER ??
  path.join(process.cwd(), 'dist', 'main', 'workers', 'embedding.worker.cjs');
const whisperModelDir =
  process.env.STONE_WHISPER_MODEL_DIR ??
  path.join(path.dirname(path.resolve(configPath)), 'whisper-models');
const whisperBinaryPath = process.env.STONE_WHISPER_BINARY;
const whisperServerBinaryPath = process.env.STONE_WHISPER_SERVER_BINARY;
const host = process.env.STONE_HOST ?? '127.0.0.1';
const port = Number(process.env.STONE_PORT ?? '3000');

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid STONE_PORT: ${process.env.STONE_PORT}`);
}

const database = createDatabaseManager();
await database.initialize();

const runtime = await createNoteServerRuntime({
  db: database.getDrizzle(),
  databaseManager: database,
  workspacePath,
  configPath,
  mlCacheDir,
  embeddingWorkerPath,
  whisperModelDir,
  ...(whisperBinaryPath ? { whisperBinaryPath } : {}),
  ...(whisperServerBinaryPath ? { whisperServerBinaryPath } : {}),
});
const server = await createNoteHttpServer({
  runtime,
  staticDir,
});

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.log.info({ signal }, 'Shutting down Stone notes server');
  await server.close();
  await runtime.dispose();
  await database.close();
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        server.log.error(error, 'Server shutdown failed');
        process.exit(1);
      });
  });
}

await server.listen({ host, port });
server.log.info(
  {
    url: `http://${host}:${port}`,
    database: database.getDbPath(),
    workspace: runtime.workspace.folderPath,
  },
  'Stone notes server is ready',
);
