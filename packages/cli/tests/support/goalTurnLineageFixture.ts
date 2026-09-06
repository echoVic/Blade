import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { SessionRuntime } from '../../src/agent/runtime/SessionRuntime.js';
import { PermissionMode } from '../../src/config/types.js';
import { resetProjectionDbCache } from '../../src/context/storage/sqlite/projection.js';
import type { GoalTurnLineage } from '../../src/goals/types.js';
import { SessionService } from '../../src/services/SessionService.js';

export interface GoalTurnLineageFixture {
  root: string;
  workspace: string;
  home: string;
  storageRoot: string;
  sessionId: string;
  secret: string;
  expectedBeforeResume: GoalTurnLineage;
  provider: {
    requestCount(): number;
    close(): Promise<void>;
  };
}

function writeSse(
  response: import('node:http').ServerResponse,
  payloads: readonly unknown[]
): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  });
  for (const payload of payloads) {
    response.write('data: ' + JSON.stringify(payload) + '\n\n');
  }
  response.end('data: [DONE]\n\n');
}

function blockedGoalChunks(requestNumber: number): unknown[] {
  return [
    {
      id: 'goal-lineage-tool-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'goal-lineage-update-' + requestNumber,
                type: 'function',
                function: {
                  name: 'UpdateGoal',
                  arguments: JSON.stringify({
                    status: 'blocked',
                    reason:
                      'Deterministic lineage fixture reached its terminal boundary.',
                  }),
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'goal-lineage-tool-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
    },
  ];
}

function finalChunks(requestNumber: number): unknown[] {
  return [
    {
      id: 'goal-lineage-final-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'Goal lineage recorded.' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'goal-lineage-final-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 24, completion_tokens: 4, total_tokens: 28 },
    },
  ];
}

export async function createGoalTurnLineageFixture(
  createHttpServer: typeof import('node:http').createServer
): Promise<GoalTurnLineageFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blade-goal-lineage-'));
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  const storageRoot = path.join(root, 'storage');
  const sessionId = 'goal-lineage-' + randomBytes(6).toString('hex');
  const secret = 'goal-lineage-secret-' + randomBytes(10).toString('hex');
  let requests = 0;
  const server: Server = createHttpServer((request, response) => {
    void (async () => {
      for await (const _chunk of request) {
        // Drain the complete Provider request before responding.
      }
      requests++;
      writeSse(
        response,
        requests % 2 === 1 ? blockedGoalChunks(requests) : finalChunks(requests)
      );
    })().catch((error: unknown) =>
      response.destroy(error instanceof Error ? error : undefined)
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  const baseUrl = 'http://127.0.0.1:' + address.port + '/v1';
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(path.join(home, '.blade'), { recursive: true }),
    mkdir(storageRoot, { recursive: true }),
  ]);
  await writeFile(
    path.join(home, '.blade', 'config.json'),
    JSON.stringify(
      {
        currentModelId: 'goal-lineage-fixture',
        models: [
          {
            id: 'goal-lineage-fixture',
            displayName: 'Goal lineage fixture',
            provider: 'deepseek',
            model: 'deepseek-v4-flash',
            overrides: {
              baseUrl,
              maxRetries: 0,
              maxOutputTokens: 1024,
              timeout: 30000,
            },
          },
        ],
        permissionMode: PermissionMode.YOLO,
        maxTurns: 3,
        hooks: { enabled: false },
        disableAllHooks: true,
        mcpServers: {},
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );

  const previous = process.env.BLADE_STORAGE_ROOT;
  process.env.BLADE_STORAGE_ROOT = storageRoot;
  resetProjectionDbCache();
  try {
    await SessionService.createSessionMetadata(sessionId, workspace, {
      title: 'Goal turn lineage',
      taskStatus: 'completed',
      selectedModelId: 'goal-lineage-fixture',
      permissionMode: PermissionMode.YOLO,
    });
    const runtime = await SessionRuntime.create({
      sessionId,
      workspaceRoot: workspace,
    });
    try {
      const rootTurn = await runtime.prepareInputTurn('create the durable Goal');
      if (!rootTurn.accepted) throw new Error('Root Goal turn was not accepted');
      const created = await runtime.createGoal(
        { objective: 'Preserve and expose the exact durable Goal turn chain.' },
        { turnId: rootTurn.handle.id }
      );
      await runtime.finishTurn(rootTurn.handle, {
        outcome: {
          status: 'completed',
          turnsCount: 1,
          toolCallsCount: 1,
          durationMs: 1,
        },
      });

      const firstContinuation = await runtime.beginGoalTurn(created);
      if (!firstContinuation) throw new Error('First Goal continuation was not bound');
      await runtime.finishTurn(firstContinuation.handle, {
        outcome: {
          status: 'completed',
          turnsCount: 1,
          toolCallsCount: 0,
          durationMs: 1,
        },
      });

      const userTurn = await runtime.prepareInputTurn('intervening durable user turn');
      if (!userTurn.accepted) throw new Error('Intervening user turn was not accepted');
      await runtime.finishTurn(userTurn.handle, {
        outcome: {
          status: 'completed',
          turnsCount: 1,
          toolCallsCount: 0,
          durationMs: 1,
        },
      });

      return {
        root,
        workspace,
        home,
        storageRoot,
        sessionId,
        secret,
        expectedBeforeResume: {
          rootTurnId: rootTurn.handle.id,
          currentTurnId: userTurn.handle.id,
          parentTurnId: firstContinuation.handle.id,
        },
        provider: {
          requestCount: () => requests,
          close: async () => {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve()))
            );
          },
        },
      };
    } finally {
      await runtime.dispose();
    }
  } catch (error) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  } finally {
    resetProjectionDbCache();
    if (previous === undefined) delete process.env.BLADE_STORAGE_ROOT;
    else process.env.BLADE_STORAGE_ROOT = previous;
  }
}

export function goalTurnLineageEnvironment(
  fixture: GoalTurnLineageFixture
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: fixture.home,
    BLADE_STORAGE_ROOT: fixture.storageRoot,
    BLADE_AUTO_MEMORY: '0',
    BLADE_TELEMETRY_DISABLED: '1',
    BLADE_VERSION: '999.0.0',
    BLADE_API_KEY: fixture.secret,
    TERM: 'xterm-256color',
  };
}
