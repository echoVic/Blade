// @vitest-environment jsdom

import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionRuntime } from '../../../src/agent/runtime/SessionRuntime.js';
import { PermissionMode, type RuntimeConfig } from '../../../src/config/types.js';
import { PersistentStore } from '../../../src/context/storage/PersistentStore.js';
import { getSessionFilePath } from '../../../src/context/storage/pathUtils.js';
import { HookManager } from '../../../src/hooks/HookManager.js';
import { resetWorkspaceIdentityCache } from '../../../src/security/WorkspaceIdentity.js';
import { WorkspaceTrustService } from '../../../src/security/WorkspaceTrustService.js';
import { SessionService } from '../../../src/services/SessionService.js';
import {
  ensureStoreInitialized,
  getState,
  vanillaStore,
} from '../../../src/store/vanilla.js';
import { useCommandHandler } from '../../../src/ui/hooks/useCommandHandler.js';
import {
  type RecordingProviderProxy,
  startRecordingProviderProxy,
} from '../../support/recordingProviderProxy.js';
import { assertNoSecrets, readSessionEvents } from './sessionForkTrajectoryHarness.js';
import {
  buildRealApiRuntimeConfig,
  isRealApiTestEnabled,
  resolveRequiredDeepSeekQualificationModels,
} from './testConfig.js';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const models = isRealApiTestEnabled()
  ? resolveRequiredDeepSeekQualificationModels(process.env)
  : [];
const describeReal = models.length > 0 ? describe.sequential : describe.skip;
let originalConfig: RuntimeConfig | null = null;
const originalStorageRoot = process.env.BLADE_STORAGE_ROOT;
const PROVIDER_KEY_PREFIXES = [
  'BLADE_MODEL_API_KEY_',
  'BLADE_REAL_API_PROVIDER_KEY_',
] as const;

async function writeCredentialFreeWorkspaceConfig(
  workspace: string,
  config: RuntimeConfig
): Promise<void> {
  const configDir = path.join(workspace, '.blade');
  await mkdir(configDir, { recursive: true });
  await writeFile(
    path.join(configDir, 'config.json'),
    `${JSON.stringify(
      {
        currentModelId: config.currentModelId,
        models: config.models,
        modelProviders: config.modelProviders,
        permissionMode: config.permissionMode,
        providerForegroundRecoveryMs: 0,
        providerCircuitBreakerOpenMs: 0,
        hooks: { enabled: false },
        disableAllHooks: true,
        mcpServers: {},
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
}

function snapshotProviderKeyEnvironment(): Map<string, string> {
  return new Map(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        PROVIDER_KEY_PREFIXES.some((prefix) => entry[0].startsWith(prefix))
    )
  );
}

function restoreProviderKeyEnvironment(snapshot: ReadonlyMap<string, string>): void {
  for (const name of Object.keys(process.env)) {
    if (PROVIDER_KEY_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      delete process.env[name];
    }
  }
  for (const [name, value] of snapshot) process.env[name] = value;
}

beforeAll(async () => {
  await ensureStoreInitialized();
  originalConfig = getState().config.config;
});

afterAll(() => {
  if (originalConfig) getState().config.actions.setConfig(originalConfig);
  if (originalStorageRoot === undefined) delete process.env.BLADE_STORAGE_ROOT;
  else process.env.BLADE_STORAGE_ROOT = originalStorageRoot;
});

describeReal('TUI pending-resume Session handoff (real API)', () => {
  for (const model of models) {
    it.skipIf(process.platform === 'win32')(
      `${model.model} wakes the replacement Session after cancelled initialization drains`,
      { retry: 0, timeout: 180_000 },
      async () => {
        if (!model.baseURL) throw new Error('Missing handoff Provider');
        const rootPath = await realpath(
          await mkdtemp(path.join(os.tmpdir(), 'blade-pending-handoff-'))
        );
        const oldWorkspace = path.join(rootPath, 'old');
        const newWorkspace = path.join(rootPath, 'next');
        const storageRoot = path.join(rootPath, 'storage');
        const oldSessionId = `handoff-old-${Date.now()}`;
        const newSessionId = `handoff-next-${Date.now()}`;
        const oldPrompt = 'Reply exactly OLD_MUST_NOT_RUN and do not use tools.';
        const newPrompt = 'Reply exactly HANDOFF_RECOVERED and do not use tools.';
        const originalStore = getState();
        const keys = snapshotProviderKeyEnvironment();
        const originalMemory = process.env.BLADE_AUTO_MEMORY;
        const hookManager = HookManager.getInstance();
        const hooksEnabled = hookManager.isEnabled();
        const proxy = await startRecordingProviderProxy(model.baseURL);
        let renderer: ReactDOM.Root | undefined;
        let container: HTMLDivElement | undefined;
        let hook: ReturnType<typeof useCommandHandler> | undefined;
        let seed: SessionRuntime | undefined;
        let writer: Awaited<ReturnType<typeof open>> | undefined;
        let fifo: string | undefined;
        const errors: unknown[] = [];
        function Harness() {
          hook = useCommandHandler(undefined, undefined, undefined, 2);
          return null;
        }
        const wait = async (
          predicate: () => boolean | Promise<boolean>,
          label: string,
          timeout = 30_000
        ) => {
          const deadline = Date.now() + timeout;
          while (Date.now() < deadline) {
            if (await predicate()) return;
            await act(async () => {
              await new Promise((resolve) => setTimeout(resolve, 25));
            });
          }
          throw new Error(label);
        };
        try {
          process.env.BLADE_STORAGE_ROOT = storageRoot;
          process.env.BLADE_AUTO_MEMORY = '1';
          hookManager.disable();
          const base = buildRealApiRuntimeConfig({ ...model, baseURL: proxy.baseUrl });
          const config: RuntimeConfig = {
            ...base,
            permissionMode: PermissionMode.DEFAULT,
            providerForegroundRecoveryMs: 0,
            hooks: { ...base.hooks, enabled: false },
            disableAllHooks: true,
            mcpServers: {},
            models: base.models.map((entry) => ({
              ...entry,
              overrides: { ...entry.overrides, maxRetries: 0 },
            })),
          };
          getState().config.actions.setConfig(config);
          for (const [workspace, sessionId, prompt] of [
            [oldWorkspace, oldSessionId, oldPrompt],
            [newWorkspace, newSessionId, newPrompt],
          ] as const) {
            await mkdir(workspace, { recursive: true });
            await writeCredentialFreeWorkspaceConfig(workspace, config);
            await WorkspaceTrustService.getInstance().trust(workspace);
            await SessionService.createSessionMetadata(sessionId, workspace, {
              title: 'Pending handoff',
              taskStatus: 'completed',
              selectedModelId: config.currentModelId,
              permissionMode: 'default',
            });
            seed = await SessionRuntime.create({
              sessionId,
              workspaceRoot: workspace,
              permissionMode: PermissionMode.DEFAULT,
              mcpServers: {},
              agents: [],
            });
            const queued = await seed.enqueueSteering(prompt, {
              allowBeforeTurn: true,
            });
            if (!queued.accepted || !queued.messageId)
              throw new Error('Durable handoff input was not accepted');
            await new PersistentStore(workspace).saveMessage(
              sessionId,
              'user',
              prompt,
              null,
              { inboxMessageId: queued.messageId }
            );
            await seed.dispose();
            seed = undefined;
          }
          const oldTranscript = getSessionFilePath(oldWorkspace, oldSessionId);
          const nextTranscript = getSessionFilePath(newWorkspace, newSessionId);
          const memoryDir = path.join(path.dirname(oldTranscript), 'memory');
          await mkdir(memoryDir, { recursive: true });
          fifo = path.join(memoryDir, 'MEMORY.md');
          await promisify(execFile)('mkfifo', [fifo]);
          vanillaStore.setState((state) => ({
            ...state,
            session: {
              ...state.session,
              sessionId: oldSessionId,
              workspaceRoot: oldWorkspace,
              messages: [],
              restoredContextMessages: null,
              error: null,
            },
            command: {
              ...state.command,
              isProcessing: false,
              abortController: null,
              followUpPresentations: {},
            },
          }));
          container = document.createElement('div');
          document.body.appendChild(container);
          renderer = ReactDOM.createRoot(container);
          await act(async () => {
            renderer!.render(<Harness />);
          });
          await wait(async () => {
            try {
              writer = await open(fifo!, constants.O_WRONLY | constants.O_NONBLOCK);
              return true;
            } catch (error) {
              if (error instanceof Error && 'code' in error && error.code === 'ENXIO')
                return false;
              throw error;
            }
          }, 'Old Runtime did not reach the initialization memory barrier');
          const oldController = getState().command.abortController;
          expect(oldController).not.toBeNull();
          expect(getState().command.isProcessing).toBe(true);
          await act(async () => {
            vanillaStore.setState((state) => ({
              ...state,
              session: {
                ...state.session,
                sessionId: newSessionId,
                workspaceRoot: newWorkspace,
                messages: [],
                restoredContextMessages: null,
                error: null,
              },
            }));
            await Promise.resolve();
          });
          await wait(
            () => oldController?.signal.aborted === true,
            'Session replacement did not cancel the old pending run'
          );
          expect(getState().command.isProcessing).toBe(true);
          expect(await SessionRuntime.hasPendingInbox(newWorkspace, newSessionId)).toBe(
            true
          );
          expect(proxy.forwardedRequestNumbers).toEqual([]);
          await rename(fifo, `${fifo}.draining`);
          fifo = undefined;
          await writer!.writeFile('Old initialization may now settle.\n');
          await writer!.close();
          writer = undefined;
          await wait(
            () => getState().command.abortController !== oldController,
            'Old pending initialization retained command ownership'
          );
          await wait(
            () =>
              readSessionEvents(nextTranscript).some(
                (event) => event.type === 'turn_started'
              ),
            'Replacement Session did not wake after old pending initialization released',
            3_000
          );
          await wait(
            async () =>
              !getState().command.isProcessing &&
              !(await SessionRuntime.hasPendingInbox(newWorkspace, newSessionId)),
            'Replacement Session did not complete its durable input',
            90_000
          );
          const events = readSessionEvents(nextTranscript);
          expect(events.filter((event) => event.type === 'turn_started')).toHaveLength(
            1
          );
          expect(
            events.filter((event) => event.type === 'turn_completed')
          ).toHaveLength(1);
          expect(
            events.filter((event) => event.type === 'inbox_acknowledged')
          ).toHaveLength(1);
          expect(
            readSessionEvents(oldTranscript).filter(
              (event) => event.type === 'turn_started'
            )
          ).toHaveLength(0);
          expect(await SessionRuntime.hasPendingInbox(oldWorkspace, oldSessionId)).toBe(
            true
          );
          expect(
            getState()
              .session.messages.filter((message) => message.role === 'assistant')
              .map((message) => message.content)
          ).toEqual(['HANDOFF_RECOVERED']);
          expect(getState().session.error).toBeNull();
          expect(proxy.forwardedRequestNumbers).toEqual([1]);
          expect(proxy.requestBodies[0]).toContain(newPrompt);
          expect(proxy.requestBodies[0]).not.toContain(oldPrompt);
          assertNoSecrets(
            {
              old: await readFile(oldTranscript, 'utf8'),
              next: await readFile(nextTranscript, 'utf8'),
            },
            [model.apiKey]
          );
          console.log(
            `[pending-session-handoff] ${JSON.stringify({ model: model.model, oldCancelledBeforeProvider: true, replacementCompleted: true, oldInputPreserved: true, providerRequests: proxy.forwardedRequestNumbers })}`
          );
        } catch (error) {
          errors.push(error);
        } finally {
          if (fifo)
            await rename(fifo, `${fifo}.cleanup`).catch((error: unknown) => {
              errors.push(error);
            });
          if (writer)
            await writer.close().catch((error: unknown) => {
              errors.push(error);
            });
          if (renderer)
            await act(async () => {
              renderer!.unmount();
            });
          const cleanup = await Promise.allSettled([
            seed?.dispose(),
            hook?.cleanupAgent(),
            proxy.close(),
          ]);
          for (const result of cleanup)
            if (result.status === 'rejected') errors.push(result.reason);
          container?.remove();
          vanillaStore.setState(originalStore, true);
          if (hooksEnabled) hookManager.enable();
          else hookManager.disable();
          if (originalStorageRoot === undefined) delete process.env.BLADE_STORAGE_ROOT;
          else process.env.BLADE_STORAGE_ROOT = originalStorageRoot;
          if (originalMemory === undefined) delete process.env.BLADE_AUTO_MEMORY;
          else process.env.BLADE_AUTO_MEMORY = originalMemory;
          restoreProviderKeyEnvironment(keys);
          if (cleanup.every((result) => result.status === 'fulfilled'))
            await rm(rootPath, { recursive: true, force: true });
        }
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1)
          throw new AggregateError(
            errors,
            'Pending handoff trajectory and cleanup failed'
          );
      }
    );
  }
});

describeReal('TUI durable pending-resume retry trajectory (real API)', () => {
  for (const model of models) {
    it(`${model.model} retries one safe pending resume after a real Provider failure`, {
      retry: 0,
      timeout: 240_000,
    }, async () => {
      if (!model.baseURL) throw new Error(`${model.model} base URL is unavailable`);
      const originalProviderKeyEnvironment = snapshotProviderKeyEnvironment();
      const sessionId = `tui-retry-${model.model}-${Date.now()}`;
      const marker = `TUI_PENDING_RESUME_RECOVERED_${model.model.replace(/[^a-z0-9]/gi, '_')}`;
      const prompt = [
        'Do not call or mention any tools.',
        `Reply with exactly ${marker}`,
        'Do not add punctuation, markdown, explanation, or any other text.',
      ].join(' ');
      const originalStore = getState();
      const hookManager = HookManager.getInstance();
      const hooksWereEnabled = hookManager.isEnabled();
      let workspace: string | undefined;
      let proxy: RecordingProviderProxy | undefined;
      let container: HTMLDivElement | undefined;
      let root: ReactDOM.Root | undefined;
      let hook: ReturnType<typeof useCommandHandler> | undefined;
      let seedRuntime: SessionRuntime | undefined;

      function Harness() {
        hook = useCommandHandler(undefined, undefined, undefined, 2);
        return null;
      }

      try {
        const createdWorkspace = await mkdtemp(
          path.join(os.tmpdir(), 'blade-tui-retry-')
        );
        workspace = createdWorkspace;
        const storageRoot = path.join(createdWorkspace, '.blade-storage');
        const startedProxy = await startRecordingProviderProxy(model.baseURL, {
          inject503Once: { path: '/v1/chat/completions', retryAfterMs: 0 },
        });
        proxy = startedProxy;
        const baseConfig = buildRealApiRuntimeConfig({
          ...model,
          baseURL: startedProxy.baseUrl,
        });
        const config: RuntimeConfig = {
          ...baseConfig,
          permissionMode: PermissionMode.DEFAULT,
          providerForegroundRecoveryMs: 0,
          hooks: { ...baseConfig.hooks, enabled: false },
          disableAllHooks: true,
          mcpServers: {},
          models: baseConfig.models.map((entry) => ({
            ...entry,
            overrides: { ...entry.overrides, maxRetries: 0 },
          })),
        };
        container = document.createElement('div');
        document.body.appendChild(container);
        const mountedRoot = ReactDOM.createRoot(container);
        root = mountedRoot;
        process.env.BLADE_STORAGE_ROOT = storageRoot;
        hookManager.disable();
        getState().config.actions.setConfig(config);
        await writeCredentialFreeWorkspaceConfig(createdWorkspace, config);
        WorkspaceTrustService.resetInstance();
        resetWorkspaceIdentityCache();
        await WorkspaceTrustService.getInstance().trust(createdWorkspace);
        await SessionService.createSessionMetadata(sessionId, createdWorkspace, {
          title: 'TUI pending-resume retry qualification',
          taskStatus: 'completed',
          selectedModelId: config.currentModelId,
          permissionMode: 'default',
        });
        seedRuntime = await SessionRuntime.create({
          sessionId,
          workspaceRoot: createdWorkspace,
          permissionMode: PermissionMode.DEFAULT,
          mcpServers: {},
          agents: [],
        });
        const queued = await seedRuntime.enqueueSteering(prompt, {
          allowBeforeTurn: true,
        });
        expect(queued).toMatchObject({ accepted: true, delivery: 'next_turn' });
        if (!queued.messageId) throw new Error('Seed inbox message ID is missing');
        await new PersistentStore(createdWorkspace).saveMessage(
          sessionId,
          'user',
          prompt,
          null,
          { inboxMessageId: queued.messageId }
        );
        await seedRuntime.dispose();
        seedRuntime = undefined;

        vanillaStore.setState((state) => ({
          ...state,
          session: {
            ...state.session,
            sessionId,
            workspaceRoot: createdWorkspace,
            messages: [],
            restoredContextMessages: null,
            error: null,
          },
          command: {
            ...state.command,
            isProcessing: false,
            abortController: null,
            followUpPresentations: {},
          },
        }));

        await act(async () => {
          mountedRoot.render(<Harness />);
          await Promise.resolve();
        });

        await vi.waitFor(
          async () => {
            expect(
              await SessionRuntime.hasPendingInbox(createdWorkspace, sessionId)
            ).toBe(false);
            expect(getState().command.isProcessing).toBe(false);
            expect(
              getState().session.messages.filter(
                (message) => message.role === 'assistant' && message.content === marker
              )
            ).toHaveLength(1);
          },
          { timeout: 220_000, interval: 100 }
        );

        const store = new PersistentStore(createdWorkspace);
        const events = (await store.loadEvents(sessionId)) ?? [];
        const transcript = await readFile(
          getSessionFilePath(createdWorkspace, sessionId),
          'utf8'
        );
        const lifecycleForForwarded = startedProxy.requestLifecycle.filter(
          (entry) => entry.requestNumber === startedProxy.forwardedRequestNumbers[0]
        );
        expect(startedProxy.injectedRequestNumbers).toEqual([1]);
        expect(startedProxy.forwardedRequestNumbers).toHaveLength(1);
        expect(lifecycleForForwarded).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ phase: 'headers_received', statusClass: 2 }),
            expect.objectContaining({ phase: 'body_completed' }),
            expect.objectContaining({ phase: 'downstream_ended' }),
          ])
        );
        expect(events.filter((event) => event.type === 'turn_started')).toHaveLength(2);
        expect(events.filter((event) => event.type === 'turn_aborted')).toHaveLength(1);
        expect(events.filter((event) => event.type === 'turn_completed')).toHaveLength(
          1
        );
        expect(
          events.filter((event) => event.type === 'inbox_acknowledged')
        ).toHaveLength(1);
        const assistantText = getState()
          .session.messages.filter((message) => message.role === 'assistant')
          .map((message) => message.content);
        expect(assistantText).toEqual([marker]);
        expect(getState().session.error).toBeNull();
        assertNoSecrets(
          {
            transcript,
            requestPaths: startedProxy.requestPaths,
            requestLifecycle: startedProxy.requestLifecycle,
          },
          [model.apiKey]
        );
      } finally {
        await seedRuntime?.dispose().catch(() => undefined);
        await hook?.cleanupAgent().catch(() => undefined);
        if (root) {
          try {
            await act(async () => {
              root?.unmount();
              await Promise.resolve();
            });
          } catch {
            // Best-effort cleanup must not replace the qualification result.
          }
        }
        container?.remove();
        vanillaStore.setState(originalStore, true);
        if (originalConfig) getState().config.actions.setConfig(originalConfig);
        if (hooksWereEnabled) hookManager.enable();
        else hookManager.disable();
        WorkspaceTrustService.resetInstance();
        resetWorkspaceIdentityCache();
        if (originalStorageRoot === undefined) delete process.env.BLADE_STORAGE_ROOT;
        else process.env.BLADE_STORAGE_ROOT = originalStorageRoot;
        restoreProviderKeyEnvironment(originalProviderKeyEnvironment);
        await proxy?.close().catch(() => undefined);
        if (workspace) await rm(workspace, { recursive: true, force: true });
      }
    });
  }
});
