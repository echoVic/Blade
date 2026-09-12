import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type McpCatalogChange, McpRegistry } from '../../src/mcp/McpRegistry.js';
import { McpConnectionStatus } from '../../src/mcp/types.js';
import { ToolRegistry } from '../../src/tools/registry/ToolRegistry.js';

vi.unmock('child_process');
vi.unmock('node:child_process');

const serverEntry = path.resolve(
  import.meta.dirname,
  '../support/fake-mcp-dynamic-catalog-server.mjs'
);

describe('dynamic MCP tool catalog over real stdio transport', () => {
  let root: string;
  let pidFile: string;
  let traceFile: string;
  let registry: McpRegistry;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'blade-mcp-dynamic-catalog-'));
    pidFile = path.join(root, 'server.pid');
    traceFile = path.join(root, 'trace.jsonl');
    registry = McpRegistry.createIsolated();
  });

  afterEach(async () => {
    await registry.disconnectAll();
    await rm(root, { recursive: true, force: true });
  });

  it('cancels a waiter without closing a real shared MCP catalog refresh', async () => {
    const holdFile = path.join(root, 'hold');
    const releaseFile = path.join(root, 'release');
    await registry.registerServer('dynamic', {
      type: 'stdio',
      command: process.execPath,
      args: [serverEntry],
      env: {
        MCP_DYNAMIC_PID_FILE: pidFile,
        MCP_DYNAMIC_TRACE_FILE: traceFile,
        MCP_DYNAMIC_HOLD_FILE: holdFile,
        MCP_DYNAMIC_RELEASE_FILE: releaseFile,
      },
    });
    const toolRegistry = new ToolRegistry();
    toolRegistry.setMcpCatalogBarrier(() => registry.waitForCatalogIdle());
    await writeFile(holdFile, 'hold');
    await expect
      .poll(async () => (await readFile(traceFile, 'utf8')).includes('catalog_held'))
      .toBe(true);
    const client = new AbortController();
    const waiting = toolRegistry.waitForMcpCatalogIdle(client.signal).then(
      () => 'completed',
      (error: unknown) => error
    );
    let otherSettled = false;
    const other = toolRegistry.waitForMcpCatalogIdle().then(() => {
      otherSettled = true;
    });
    try {
      client.abort('caller-cancelled');
      await expect(waiting).resolves.toMatchObject({ name: 'AbortError' });
      expect(otherSettled).toBe(false);
      expect(registry.getServerStatus('dynamic')?.status).toBe(
        McpConnectionStatus.CONNECTED
      );
      expect(await readFile(traceFile, 'utf8')).not.toContain('catalog_released');
      await writeFile(releaseFile, 'release');
      await other;
      expect(registry.getCatalogSnapshot().tools.map((tool) => tool.name)).toContain(
        'mcp__dynamic__stable_marker'
      );
      const response = await registry
        .getServerStatus('dynamic')!
        .client.callTool('stable_marker', { marker: 'AFTER_CANCEL' });
      expect(response.content[0]?.text).toBe('DYNAMIC_MCP_OK:AFTER_CANCEL');
    } finally {
      await writeFile(releaseFile, 'release');
      await Promise.all([waiting, other]);
    }
  });

  it.each([false, true])(
    'releases fixture watchers on stdin EOF while catalog held: %s',
    async (held) => {
      const holdFile = path.join(root, 'hold');
      const releaseFile = path.join(root, 'release');
      if (held) await writeFile(holdFile, 'hold');
      const child = spawn(process.execPath, [serverEntry], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_DYNAMIC_PID_FILE: pidFile,
          MCP_DYNAMIC_TRACE_FILE: traceFile,
          MCP_DYNAMIC_HOLD_FILE: holdFile,
          MCP_DYNAMIC_RELEASE_FILE: releaseFile,
        },
      });
      child.stdout.resume();
      child.stderr.resume();
      const closed = new Promise<void>((resolve) =>
        child.once('close', () => resolve())
      );
      try {
        await expect
          .poll(async () => {
            try {
              await access(pidFile);
              return true;
            } catch {
              return false;
            }
          })
          .toBe(true);
        if (held) {
          child.stdin.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
              params: {},
            }) + '\n'
          );
          await expect
            .poll(async () => {
              try {
                return (await readFile(traceFile, 'utf8')).includes('catalog_held');
              } catch {
                return false;
              }
            })
            .toBe(true);
        }
        child.stdin.end();
        await expect.poll(() => child.exitCode, { timeout: 1_000 }).toBe(0);
        expect(child.signalCode).toBeNull();
        await closed;
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        await closed;
      }
    }
  );

  it('publishes bounded revisions and retains the last valid catalog', async () => {
    const changes: McpCatalogChange[] = [];
    const refreshFailures: unknown[] = [];
    registry.on('catalogChanged', (change) => changes.push(change));
    registry.on('catalogRefreshFailed', (failure) => refreshFailures.push(failure));

    await registry.registerServer('dynamic', {
      type: 'stdio',
      command: process.execPath,
      args: [serverEntry],
      env: {
        MCP_DYNAMIC_PID_FILE: pidFile,
        MCP_DYNAMIC_TRACE_FILE: traceFile,
      },
    });

    expect(registry.getServerStatus('dynamic')?.status).toBe(
      McpConnectionStatus.CONNECTED
    );
    expect(registry.getCatalogSnapshot().tools.map((tool) => tool.name)).toEqual([
      'mcp__dynamic__unlock_catalog',
      'mcp__dynamic__stable_marker',
      'mcp__dynamic__obsolete_marker',
    ]);
    expect(changes[0]).toMatchObject({
      revision: 1,
      reason: 'connection',
      added: [
        'mcp__dynamic__obsolete_marker',
        'mcp__dynamic__stable_marker',
        'mcp__dynamic__unlock_catalog',
      ],
      removed: [],
      updated: [],
    });

    const client = registry.getServerStatus('dynamic')!.client;
    const unlock = await client.callTool('unlock_catalog');
    expect(unlock.content[0]?.text).toBe('CATALOG_UNLOCKED');
    await expect.poll(() => registry.getCatalogSnapshot().revision).toBe(2);

    expect(registry.getCatalogSnapshot().tools.map((tool) => tool.name)).toEqual([
      'mcp__dynamic__dynamic_marker',
      'mcp__dynamic__stable_marker',
      'mcp__dynamic__poison_catalog',
    ]);
    expect(changes.at(-1)).toMatchObject({
      revision: 2,
      reason: 'notification',
      added: ['mcp__dynamic__dynamic_marker', 'mcp__dynamic__poison_catalog'],
      removed: ['mcp__dynamic__obsolete_marker', 'mcp__dynamic__unlock_catalog'],
      updated: ['mcp__dynamic__stable_marker'],
    });

    const marker = await client.callTool('dynamic_marker', {
      marker: 'CATALOG',
    });
    expect(marker.content[0]?.text).toBe('DYNAMIC_MCP_OK:CATALOG');
    const poison = await client.callTool('poison_catalog');
    expect(poison.content[0]?.text).toBe('POISON_SENT');
    await expect.poll(() => refreshFailures.length).toBe(1);

    expect(registry.getCatalogSnapshot().revision).toBe(2);
    expect(registry.getCatalogSnapshot().tools.map((tool) => tool.name)).toEqual([
      'mcp__dynamic__dynamic_marker',
      'mcp__dynamic__stable_marker',
      'mcp__dynamic__poison_catalog',
    ]);
    expect(refreshFailures[0]).toMatchObject({
      serverName: 'dynamic',
      reason: 'notification',
      error: expect.objectContaining({
        message: expect.stringContaining('duplicate tool "duplicate"'),
      }),
    });

    const trace = (await readFile(traceFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(trace.filter((entry) => entry.event === 'tools_list')).toHaveLength(5);
    expect(trace.filter((entry) => entry.event === 'marker_called')).toEqual([
      expect.objectContaining({
        name: 'dynamic_marker',
        marker: 'CATALOG',
      }),
    ]);

    await expect(access(pidFile)).resolves.toBeUndefined();
    const pid = Number(await readFile(pidFile, 'utf8'));
    await registry.disconnectAll();
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
  });
});
