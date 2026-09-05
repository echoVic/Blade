import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PermissionMode } from '../../src/config/types.js';
import { resetProjectionDbCache } from '../../src/context/storage/sqlite/projection.js';
import { GoalStore } from '../../src/goals/GoalStore.js';
import { SessionService } from '../../src/services/SessionService.js';

export interface GoalExecutionHostFailureFixture {
  root: string;
  workspace: string;
  home: string;
  storageRoot: string;
  sessionId: string;
  secret: string;
  provider: {
    requestCount(): number;
    releaseHeld(): void;
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

function bashToolChunks(requestNumber: number): unknown[] {
  return [
    {
      id: 'host-failure-tool-' + requestNumber,
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
                id: 'host-failure-bash-' + requestNumber,
                type: 'function',
                function: {
                  name: 'Bash',
                  arguments: JSON.stringify({
                    command: 'node -e "setInterval(() => {}, 1000)"',
                    timeout: 1000,
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
      id: 'host-failure-tool-' + requestNumber,
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
      id: 'host-failure-final-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'Execution attempt recorded.' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'host-failure-final-' + requestNumber,
      object: 'chat.completion.chunk',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 24, completion_tokens: 4, total_tokens: 28 },
    },
  ];
}

export async function createGoalExecutionHostFailureFixture(
  createHttpServer: typeof import('node:http').createServer,
  options: { holdRequestNumber?: number } = {}
): Promise<GoalExecutionHostFailureFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blade-goal-host-'));
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  const storageRoot = path.join(root, 'storage');
  const sessionId = 'goal-host-' + randomBytes(6).toString('hex');
  const secret = 'goal-host-secret-' + randomBytes(10).toString('hex');
  let requests = 0;
  let releaseHeld!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseHeld = resolve;
  });
  const server: Server = createHttpServer((request, response) => {
    void (async () => {
      for await (const _chunk of request) {
        // Drain the request before responding.
      }
      requests++;
      if (requests === options.holdRequestNumber) await held;
      writeSse(
        response,
        requests % 2 === 1 ? bashToolChunks(requests) : finalChunks(requests)
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
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(path.join(home, '.blade'), { recursive: true }),
    mkdir(storageRoot, { recursive: true }),
  ]);
  await writeFile(
    path.join(home, '.blade', 'config.json'),
    JSON.stringify(
      {
        currentModelId: 'goal-host-fixture',
        models: [
          {
            id: 'goal-host-fixture',
            displayName: 'Goal host fixture',
            provider: 'deepseek',
            model: 'deepseek-v4-flash',
            overrides: {
              baseUrl: 'http://127.0.0.1:' + address.port + '/v1',
              maxRetries: 0,
              maxOutputTokens: 1024,
              timeout: 30000,
            },
          },
        ],
        permissionMode: PermissionMode.YOLO,
        maxTurns: 4,
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
      title: 'Goal host failure',
      taskStatus: 'completed',
      selectedModelId: 'goal-host-fixture',
      permissionMode: PermissionMode.YOLO,
    });
    await new GoalStore(workspace, sessionId).create({
      objective:
        'Run the required Bash command once per continuation. After the host ' +
        'failure, finish the logical turn without calling UpdateGoal.',
    });
  } finally {
    resetProjectionDbCache();
    if (previous === undefined) delete process.env.BLADE_STORAGE_ROOT;
    else process.env.BLADE_STORAGE_ROOT = previous;
  }

  return {
    root,
    workspace,
    home,
    storageRoot,
    sessionId,
    secret,
    provider: {
      requestCount: () => requests,
      releaseHeld,
      close: async () => {
        releaseHeld();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      },
    },
  };
}

export function goalExecutionHostFailureEnvironment(
  fixture: GoalExecutionHostFailureFixture
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

export function parseGoalHostJsonl(output: string): Array<Record<string, unknown>> {
  return output.split(/\r?\n/).flatMap((line) => {
    try {
      const value = JSON.parse(line) as unknown;
      return value && typeof value === 'object' && !Array.isArray(value)
        ? [value as Record<string, unknown>]
        : [];
    } catch {
      return [];
    }
  });
}
