import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { PersistentStore } from '../../../src/context/storage/PersistentStore.js';
import { resetProjectionDbCache } from '../../../src/context/storage/sqlite/projection.js';
import { SessionService } from '../../../src/services/SessionService.js';
import {
  captureForegroundGuiLauncherIdentity,
  stopForegroundGuiLauncher,
} from '../../support/foregroundBoundedOutputWebDriver.js';
import { startRecordingProviderProxy } from '../../support/recordingProviderProxy.js';
import { assertNoSecrets } from './sessionForkTrajectoryHarness.js';
import {
  buildRealApiRuntimeConfig,
  isRealApiTestEnabled,
  resolveRequiredDeepSeekQualificationModels,
} from './testConfig.js';

const enabled = isRealApiTestEnabled();
if (enabled && process.env.REAL_API_RELEASE_MATRIX !== '1') {
  throw new Error('Textual tool-call qualification requires REAL_API_RELEASE_MATRIX=1');
}
const models = enabled ? resolveRequiredDeepSeekQualificationModels() : [];
const surfaces = ['headless', 'acp', 'pty', 'web'] as const;
const runner = path.resolve(
  import.meta.dirname,
  '../../support/textualToolCallSurfaceRunner.ts'
);
const describeReal = enabled ? describe.sequential : describe.skip;

describeReal('textual tool-call correction with real models', () => {
  it.skipIf(enabled)('requires the real API release matrix', () => undefined);
  for (const model of models) {
    for (const surface of surfaces) {
      for (const scenario of ['textual-tool', 'turn-limit'] as const) {
        it(`${model.model} ${scenario} through ${surface}`, async () => {
          if (!model.baseURL) throw new Error('Missing provider URL');
          const root = await realpath(
            await mkdtemp(path.join(os.tmpdir(), 'blade-text-tool-'))
          );
          const workspace = path.join(root, 'workspace');
          const home = path.join(root, 'home');
          const storageRoot = path.join(root, 'storage');
          await mkdir(workspace);
          await mkdir(path.join(home, '.blade'), { recursive: true });
          const turnLimit = scenario === 'turn-limit';
          const marker = turnLimit
            ? 'Let me check the file:'
            : `TEXTUAL_TOOL_RECOVERED_${randomUUID().replaceAll('-', '')}`;
          const proof = path.join(workspace, 'proof.txt');
          await writeFile(proof, marker);
          const envelope = JSON.stringify({
            tool_calls: [{ name: 'Read', arguments: { file_path: proof } }],
          });
          await writeFile(
            path.join(workspace, 'BLADE.md'),
            turnLimit
              ? [
                  '# Turn limit qualification',
                  `For this host turn-budget qualification, your first response must be exactly: ${marker}`,
                  'Emit this as ordinary assistant text, without tools, code fences, or other content.',
                  'If the host asks you to continue, reply with BUDGET_BYPASSED. Never invoke a tool.',
                ].join('\n')
              : [
                  '# Protocol recovery qualification',
                  'On your first response for this task, deliberately emit ONLY the following exact JSON text as ordinary assistant content. Do not issue a native tool call on that first response.',
                  envelope,
                  'After a host correction says the previous response contained tool-call JSON as ordinary text, stop emitting JSON and use the native Read tool exactly once to read proof.txt.',
                  'Then reply only with the file contents, without Markdown or any other text. Do not execute shell commands, modify files, or use any other tool.',
                ].join('\n')
          );
          const proxy = await startRecordingProviderProxy(model.baseURL);
          const config = buildRealApiRuntimeConfig({
            ...model,
            baseURL: proxy.baseUrl,
          });
          const configured = config.models[0];
          if (!configured) throw new Error('Missing model snapshot');
          await writeFile(
            path.join(home, '.blade', 'config.json'),
            JSON.stringify({
              currentModelId: config.currentModelId,
              models: [
                {
                  ...configured,
                  overrides: { ...configured.overrides, maxRetries: 0 },
                },
              ],
              modelProviders: config.modelProviders,
              permissionMode: 'yolo',
              maxTurns: turnLimit ? 1 : 4,
              providerForegroundRecoveryMs: 0,
              hooks: { enabled: false },
              disableAllHooks: true,
              mcpServers: {},
            }),
            { mode: 0o600 }
          );
          const originalStorageRoot = process.env.BLADE_STORAGE_ROOT;
          const sessionId = `text-tool-${randomUUID()}`;
          const child = spawn(
            process.env.BUN_EXEC_PATH ?? 'bun',
            [
              runner,
              JSON.stringify({
                scenario,
                surface,
                workspace,
                sessionId,
                marker,
                browserExecutable: chromium.executablePath(),
                prompt: turnLimit
                  ? `Follow BLADE.md for this host turn-budget qualification. Reply with exactly "${marker}" as your entire first response. Do not call any tools.`
                  : `Call Read with file_path ${proof}, then reply with the file contents. For this host protocol qualification, the first assistant response must follow the BLADE.md phase-one instruction before any native invocation. Only after the host correction should the native invocation occur.`,
              }),
            ],
            {
              env: { ...process.env, HOME: home, BLADE_STORAGE_ROOT: storageRoot },
              detached: true,
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );
          let output = '';
          let errors = '';
          child.stdout?.on('data', (data: Buffer) => {
            output = (output + data.toString()).slice(-256_000);
          });
          child.stderr?.on('data', (data: Buffer) => {
            errors = (errors + data.toString()).slice(-16_000);
          });
          const exited = new Promise<number | null>((resolve, reject) => {
            child.once('exit', resolve);
            child.once('error', reject);
          });
          void exited.catch(() => undefined);
          let identity:
            | Awaited<ReturnType<typeof captureForegroundGuiLauncherIdentity>>
            | undefined;
          let deadline: ReturnType<typeof setTimeout> | undefined;
          try {
            if (child.pid)
              identity = await captureForegroundGuiLauncherIdentity(child.pid);
            const code = await Promise.race([
              exited,
              new Promise<never>((_, reject) => {
                deadline = setTimeout(
                  () => reject(new Error('Surface runner exceeded its deadline')),
                  150_000
                );
              }),
            ]);
            expect(code, errors.replaceAll(model.apiKey, '[REDACTED]')).toBe(0);
            const evidence = JSON.parse(output.trim());
            expect(evidence).toMatchObject({
              surface,
              markerVisible: true,
              ...(turnLimit
                ? { turnLimitReached: true }
                : { internalControlHidden: true }),
              faults: [],
            });
            expect(proxy.injectedRequestNumbers).toEqual([]);
            expect(proxy.forwardedRequestNumbers).toHaveLength(turnLimit ? 1 : 3);
            if (!turnLimit) {
              expect(proxy.requestBodies[0]).not.toContain(marker);
              expect(proxy.requestBodies[1]).toContain('native tool-call interface');
              expect(proxy.requestBodies[2]).toContain(marker);
            }
            process.env.BLADE_STORAGE_ROOT = storageRoot;
            resetProjectionDbCache();
            const messages = await SessionService.loadSessionModelContext(
              evidence.sessionId,
              workspace
            );
            if (turnLimit) {
              const assistant = messages.filter(
                (message) => message.role === 'assistant'
              );
              expect(assistant).toHaveLength(1);
              expect(assistant[0]?.content).toBe(marker);
              expect(
                messages.some((message) => message.content === 'BUDGET_BYPASSED')
              ).toBe(false);
            } else {
              const proseIndex = messages.findIndex(
                (message) =>
                  message.role === 'assistant' &&
                  typeof message.content === 'string' &&
                  message.content.includes('tool_calls')
              );
              expect(proseIndex).toBeGreaterThanOrEqual(0);
              expect(messages[proseIndex]?.tool_calls).toBeUndefined();
              const corrections = messages.filter(
                (message) =>
                  message.role === 'user' &&
                  typeof message.content === 'string' &&
                  message.content.includes('native tool-call interface')
              );
              expect(corrections).toHaveLength(1);
              expect(corrections[0]?.metadata).toMatchObject({ clientVisible: false });
            }
            const events = await new PersistentStore(workspace).loadEvents(
              evidence.sessionId
            );
            const toolUses = events?.filter(
              (event) =>
                event.type === 'part_created' && event.data.partType === 'tool_call'
            );
            expect(toolUses).toHaveLength(turnLimit ? 0 : 1);
            expect(
              events?.filter((event) => event.type === 'turn_completed')
            ).toHaveLength(turnLimit && surface !== 'pty' ? 0 : 1);
            if (!turnLimit) expect(messages.at(-1)?.content).toBe(marker);
            expect(await readFile(proof, 'utf8')).toBe(marker);
            assertNoSecrets({ evidence, messages, events, output, errors }, [
              model.apiKey,
            ]);
            if (surface === 'web' && process.env.BLADE_QUALIFICATION_EVIDENCE_DIR) {
              const directory = process.env.BLADE_QUALIFICATION_EVIDENCE_DIR;
              await mkdir(directory, { recursive: true });
              await copyFile(
                path.join(
                  workspace,
                  turnLimit ? 'turn-limit.png' : 'textual-tool-recovered.png'
                ),
                path.join(directory, `${model.model}-${scenario}.png`)
              );
            }
            console.log(
              `[textual-tool-call] ${JSON.stringify({ model: model.model, surface, scenario, providerRequests: proxy.forwardedRequestNumbers.length, toolCalls: toolUses?.length, nativeExecutionOnly: true })}`
            );
          } finally {
            if (deadline) clearTimeout(deadline);
            try {
              await stopForegroundGuiLauncher(child, identity);
            } finally {
              try {
                await proxy.close();
              } finally {
                resetProjectionDbCache();
                if (originalStorageRoot === undefined)
                  delete process.env.BLADE_STORAGE_ROOT;
                else process.env.BLADE_STORAGE_ROOT = originalStorageRoot;
                await rm(root, { recursive: true, force: true });
              }
            }
          }
        }, 180_000);
      }
    }
  }
});
