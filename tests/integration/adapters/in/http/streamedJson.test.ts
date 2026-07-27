/**
 * The point of streaming these responses is that the first byte leaves before
 * the work finishes — a proxy that sees nothing for ~100s answers 524 and the
 * request is lost. These tests assert that timing directly against a real
 * socket, because Fastify's inject() buffers the whole response and would
 * report success no matter when the bytes were actually written.
 */

import http from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { sendStreamedJson } from '../../../../../src/main/adapters/in/http/streamedJson';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

interface RawResponse {
  status: number;
  body: string;
  msToFirstByte: number;
  msToEnd: number;
}

async function request(port: number, path = '/slow'): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let msToFirstByte = -1;
    let body = '';

    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST' },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (msToFirstByte < 0) msToFirstByte = Date.now() - startedAt;
          body += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            msToFirstByte,
            msToEnd: Date.now() - startedAt,
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function listen(handler: () => Promise<unknown>): Promise<number> {
  app = Fastify();
  app.post('/slow', async (req, reply) => {
    await sendStreamedJson(req, reply, 'Test', handler);
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return address.port;
}

const after = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('sendStreamedJson', () => {
  it('sends headers before the work resolves', async () => {
    const port = await listen(() => after(400, { report: 'done' }));

    const response = await request(port);

    expect(response.status).toBe(200);
    // The body cannot have arrived before the work finished...
    expect(response.msToEnd).toBeGreaterThanOrEqual(350);
    // ...yet the response must already be on the wire long before it, and not
    // merely earlier by a hair. writeHead alone buffers, so this fails unless a
    // byte is written up front — which is the whole mechanism.
    expect(response.msToFirstByte).toBeLessThan(150);
  });

  it('produces a body that parses as ordinary JSON', async () => {
    const port = await listen(() => after(50, { report: 'hello', count: 2 }));

    const response = await request(port);

    expect(JSON.parse(response.body)).toEqual({ report: 'hello', count: 2 });
  });

  it('survives whitespace heartbeats preceding the payload', async () => {
    const port = await listen(() => after(10, { ok: true }));
    const response = await request(port);

    // Whitespace is legal between JSON tokens, so a padded body is still valid.
    expect(JSON.parse(`   \n ${response.body}`)).toEqual({ ok: true });
  });

  it('reports a failure in the body, carrying the status it could not send', async () => {
    const port = await listen(() =>
      Promise.reject(Object.assign(new Error('nope'), { name: 'ValidationError' })),
    );

    const response = await request(port);

    // The status line already went out as 200 — the failure has to travel in
    // the body, which is why apiFetch keys off `error.status`.
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      error: { code: 'VALIDATION_ERROR', status: 400, message: 'nope' },
    });
  });

  it('does not leak an internal failure message', async () => {
    const port = await listen(() => Promise.reject(new Error('libsql connection string leaked')));

    const response = await request(port);
    const payload = JSON.parse(response.body) as { error: { status: number; message: string } };

    expect(payload.error.status).toBe(500);
    expect(payload.error.message).toBe('An unexpected server error occurred');
    expect(response.body).not.toContain('libsql');
  });
});
