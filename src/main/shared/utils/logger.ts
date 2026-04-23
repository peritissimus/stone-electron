/**
 * Shared Logger
 *
 * Logger utility for use across all hex layers.
 * Adds request tracing via AsyncLocalStorage (no context passing needed).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import * as util from 'node:util';
import baseLog from 'electron-log';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface RequestContext {
  request_id: string;
  channel: string;
  start_time: number;
}

interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
  request_id?: string;
  channel?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
}

const asyncContext = new AsyncLocalStorage<RequestContext>();

// Configure log file location - only if electron app is available
let app: typeof import('electron').app | undefined;
try {
  app = require('electron').app;
} catch {
  // Electron not available
}

// Dev detection:
// - Electron: app.isPackaged is false in dev, true in packaged prod
// - Non-Electron (tests/scripts): only treat NODE_ENV=development as dev
const isDev = app ? !app.isPackaged : process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: LogLevel = isDev ? 'debug' : 'info';

if (app?.getPath) {
  // Dev: console only, no file logging
  // Prod: file logging only, no console
  baseLog.transports.console.level = isDev ? 'debug' : false;
  baseLog.transports.file.level = isDev ? false : 'info';

  if (!isDev) {
    baseLog.transports.file.resolvePathFn = () => {
      const userDataPath = app!.getPath('userData');
      return path.join(userDataPath, 'logs', 'stone.log');
    };
  }
} else {
  // Electron not available (e.g., in tests or scripts)
  baseLog.transports.file.level = false;
  baseLog.transports.console.level = isDev ? 'debug' : 'info';
}

// Set log format
baseLog.transports.file.format = isDev
  ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  : '{text}';
baseLog.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializeError(error: unknown): SerializedError | undefined {
  if (!(error instanceof Error)) return undefined;
  const record: SerializedError = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) record.stack = error.stack;
  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode !== undefined) record.code = maybeCode;
  return record;
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v instanceof Error) return serializeError(v);
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'function') return `[Function ${(v as Function).name || 'anonymous'}]`;
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[Circular]';
      seen.add(v as object);
    }
    return v;
  });
}

function addContextFields(
  data: Record<string, unknown>,
  ctx: RequestContext | undefined,
): Record<string, unknown> {
  if (!ctx) return data;
  const duration_ms = Math.round(performance.now() - ctx.start_time);
  return {
    ...data,
    request_id: ctx.request_id,
    channel: ctx.channel,
    duration_ms,
  };
}

function devPrefix(ctx: RequestContext | undefined): string {
  if (!ctx) return '';
  return `[${ctx.request_id.slice(0, 8)}] `;
}

function normalizeArgs(
  args: unknown[],
): { message: string; data: Record<string, unknown>; extraArgs: unknown[] } {
  if (args.length === 0) return { message: '', data: {}, extraArgs: [] };

  const [first, second, ...rest] = args;

  if (typeof first === 'string') {
    if (isPlainRecord(second)) return { message: first, data: second, extraArgs: rest };
    const errorData = serializeError(second);
    if (errorData) return { message: first, data: { error: errorData }, extraArgs: rest };
    return { message: first, data: rest.length ? { args: [second, ...rest] } : {}, extraArgs: [] };
  }

  if (isPlainRecord(first)) {
    const data = { ...first };
    const message =
      typeof data.message === 'string'
        ? (data.message as string)
        : typeof data.event === 'string'
          ? (data.event as string)
          : 'log';
    if (typeof data.message === 'string') delete data.message;
    return { message, data, extraArgs: [second, ...rest].filter((v) => v !== undefined) };
  }

  const errorData = serializeError(first);
  if (errorData) return { message: errorData.message || 'error', data: { error: errorData }, extraArgs: [second, ...rest] };

  return { message: util.format(...args), data: {}, extraArgs: [] };
}

function write(level: LogLevel, ...args: unknown[]): void {
  if (isTest) return;
  if (levels[level] < levels[minLevel]) return;

  const ctx = asyncContext.getStore();
  const { message, data, extraArgs } = normalizeArgs(args);
  const ctxData = addContextFields(data, ctx);

  if (isDev) {
    const prefixedMessage = `${devPrefix(ctx)}${message}`;
    if (Object.keys(ctxData).length > 0) {
      baseLog[level](prefixedMessage, ctxData, ...extraArgs);
    } else if (extraArgs.length > 0) {
      baseLog[level](prefixedMessage, ...extraArgs);
    } else {
      baseLog[level](prefixedMessage);
    }
    return;
  }

  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    message,
    ...ctxData,
  };

  const line = safeJsonStringify(entry);
  if (baseLog.transports.file.level !== false) {
    baseLog[level](line);
  } else {
    // No electron-log file transport (tests/scripts); write to stdout
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (...args: unknown[]) => write('debug', ...args),
  info: (...args: unknown[]) => write('info', ...args),
  warn: (...args: unknown[]) => write('warn', ...args),
  error: (...args: unknown[]) => write('error', ...args),

  withContext<T>(channel: string, fn: () => Promise<T> | T): Promise<T> | T {
    // Always run in a fresh context so `channel` and `start_time` reflect
    // THIS operation. Preserve `request_id` from the parent (if any) for
    // trace correlation across nested calls — but never reuse its
    // start_time, otherwise async listeners registered inside a parent
    // context (e.g. chokidar events wired up inside FileWatcher.start)
    // would report duration_ms measured from the parent's start, producing
    // bogus multi-hour durations on every event.
    const existing = asyncContext.getStore();
    const ctx: RequestContext = {
      request_id: existing?.request_id ?? randomUUID(),
      channel,
      start_time: performance.now(),
    };
    return asyncContext.run(ctx, fn);
  },

  async trace<T>(
    channel: string,
    fn: () => Promise<T> | T,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const ctx: RequestContext = {
      request_id: randomUUID(),
      channel,
      start_time: performance.now(),
    };

    const baseData = data ?? {};

    return asyncContext.run(ctx, async () => {
      logger.info(`${channel} started`, baseData);
      try {
        const result = await fn();
        logger.info(`${channel} completed`, { ...baseData, success: true });
        return result;
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        const errorData = serializeError(error) ?? { name: 'UnknownError', message: 'Unknown error' };
        logger.error(`${channel} failed`, { ...baseData, success: false, code, error: errorData });
        throw error;
      }
    });
  },

  getRequestId(): string | undefined {
    return asyncContext.getStore()?.request_id;
  },
};

export const logInfo = (...args: unknown[]) => logger.info(...args);
export const logError = (...args: unknown[]) => logger.error(...args);
export const logWarn = (...args: unknown[]) => logger.warn(...args);
export const logDebug = (...args: unknown[]) => logger.debug(...args);
