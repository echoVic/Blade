import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyFetch } from '../../src/utils/proxyFetch.js';

const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'] as const;
let server: Server | undefined;
const sockets = new Set<Socket>();

beforeEach(() => {
  for (const key of proxyKeys) vi.stubEnv(key, undefined);
});

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = undefined;
  sockets.clear();
  vi.unstubAllEnvs();
});

describe('proxyFetch real HTTP lifecycle', () => {
  it.each(['timeout', 'external-abort'] as const)(
    'releases a stalled response body after %s',
    async (reason) => {
      const { createServer } =
        await vi.importActual<typeof import('node:http')>('node:http');
      let responseClosed = false;
      let bodyStarted!: () => void;
      const consuming = new Promise<void>((resolve) => {
        bodyStarted = resolve;
      });
      server = createServer((_request, response) => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write('{"version":');
        response.once('close', () => {
          responseClosed = true;
        });
      });
      server.on('connection', (socket) => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
      });
      await new Promise<void>((resolve, reject) => {
        server?.once('error', reject);
        server?.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing test server port');
      const controller = new AbortController();
      const result = proxyFetch(
        `http://127.0.0.1:${address.port}/latest`,
        {
          timeout: reason === 'timeout' ? 200 : 5000,
          signal: controller.signal,
        },
        (response) => {
          bodyStarted();
          return response.json();
        }
      );
      const assertion = expect(result).rejects.toThrow(
        reason === 'timeout' ? 'Request timeout after 200ms' : /abort/i
      );
      await consuming;
      if (reason === 'external-abort') controller.abort();
      await assertion;
      await vi.waitFor(() => expect(responseClosed).toBe(true));
    }
  );
});
