import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { spawn as spawnPty } from 'bun-pty';
import { chromium } from 'playwright';
import { SessionSchema } from '../../src/api/schemas.js';
import { PersistentStore } from '../../src/context/storage/PersistentStore.js';
import {
  captureForegroundGuiLauncherIdentity,
  isExpectedBrowserRequestFailure,
  stopForegroundGuiLauncher,
} from './foregroundBoundedOutputWebDriver.js';
import { createTuiPtyComposerReadyHandshake, writeBracketedPaste } from './ptyInput.js';

interface Input {
  surface: 'headless' | 'acp' | 'pty' | 'web';
  workspace: string;
  sessionId: string;
  prompt: string;
  marker: string;
  browserExecutable: string;
}

const input: Input = JSON.parse(process.argv[2]);
const cliEntry = path.resolve(import.meta.dirname, '../../dist/blade.js');
const childEnv = {
  ...process.env,
  BLADE_VERSION: '999.0.0',
  BLADE_AUTO_MEMORY: '0',
  BLADE_TELEMETRY_DISABLED: '1',
};
const controls = 'native tool-call interface';
let output = '';
let sessionId = input.sessionId;
const faults: string[] = [];
const cleanups = new Set<() => Promise<void>>();

function ownCleanup(cleanup: () => Promise<void>): () => Promise<void> {
  let completion: Promise<void> | undefined;
  const stop = () => {
    completion ??= Promise.resolve()
      .then(cleanup)
      .finally(() => cleanups.delete(stop));
    return completion;
  };
  cleanups.add(stop);
  return stop;
}

process.once('SIGTERM', () => {
  void Promise.allSettled([...cleanups].map((stop) => stop())).then(() =>
    process.exit(143)
  );
});

async function waitFor(check: () => boolean | Promise<boolean>, label: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(label);
}

async function finalized() {
  const events = await new PersistentStore(input.workspace).loadEvents(sessionId);
  return events?.some((event) => event.type === 'turn_completed') ?? false;
}

async function launch(args: string[]) {
  const child = spawn('node', [cliEntry, '--trust-workspace', ...args], {
    cwd: input.workspace,
    env: childEnv,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (data: Buffer) => {
    output = (output + data.toString()).slice(-256_000);
  });
  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    if (/\b(?:panic|fatal|uncaught)\b/i.test(text)) faults.push(text.slice(-1000));
  });
  let identity:
    | Awaited<ReturnType<typeof captureForegroundGuiLauncherIdentity>>
    | undefined;
  const stop = ownCleanup(() => stopForegroundGuiLauncher(child, identity));
  try {
    assert(child.pid);
    identity = await captureForegroundGuiLauncherIdentity(child.pid);
    return { child, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function waitExit(child: ChildProcess): Promise<number | null> {
  await waitFor(
    () => child.exitCode !== null || child.signalCode !== null,
    'CLI did not exit'
  );
  return child.exitCode;
}

async function run() {
  if (input.surface === 'headless') {
    const process = await launch([
      '--headless',
      '--output-format',
      'jsonl',
      '--session-id',
      sessionId,
      '--permission-mode',
      'yolo',
      '--max-turns',
      '4',
      '--no-verification-agent',
      input.prompt,
    ]);
    try {
      assert.equal(await waitExit(process.child), 0, output.slice(-2000));
      assert(output.includes(input.marker));
      assert(!output.includes(controls));
    } finally {
      await process.stop();
    }
  } else if (input.surface === 'acp') {
    const process = await launch(['--acp']);
    const notifications: acp.SessionNotification[] = [];
    const client: acp.Client = {
      async requestPermission() {
        return { outcome: { outcome: 'selected', optionId: 'allow_once' } };
      },
      async sessionUpdate(update) {
        notifications.push(update);
      },
    };
    assert(process.child.stdin && process.child.stdout);
    const connection = new acp.ClientSideConnection(
      () => client,
      acp.ndJsonStream(
        Writable.toWeb(process.child.stdin) as WritableStream<Uint8Array>,
        Readable.toWeb(process.child.stdout) as unknown as ReadableStream<Uint8Array>
      )
    );
    try {
      await connection.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {},
      });
      const session = await connection.newSession({
        cwd: input.workspace,
        mcpServers: [],
      });
      sessionId = session.sessionId;
      await connection.setSessionMode({ sessionId, modeId: 'yolo' });
      const response = await connection.prompt({
        sessionId,
        prompt: [{ type: 'text', text: input.prompt }],
      });
      assert.equal(response.stopReason, 'end_turn');
      const text = notifications
        .flatMap(({ update }) =>
          update.sessionUpdate === 'agent_message_chunk' &&
          update.content.type === 'text'
            ? [update.content.text]
            : []
        )
        .join('');
      assert(text.includes(input.marker), text);
      assert(!JSON.stringify(notifications).includes(controls));
    } finally {
      await process.stop();
      await connection.closed;
    }
  } else if (input.surface === 'pty') {
    const handshake = createTuiPtyComposerReadyHandshake(childEnv);
    const terminal = spawnPty(
      'node',
      [
        cliEntry,
        '--trust-workspace',
        '--session-id',
        sessionId,
        '--permission-mode',
        'yolo',
        '--max-turns',
        '4',
        '--no-verification-agent',
      ],
      {
        cwd: input.workspace,
        env: handshake.env,
        cols: 160,
        rows: 48,
        name: 'xterm-256color',
      }
    );
    let exited = false;
    const exit = new Promise<void>((resolve) =>
      terminal.onExit(() => {
        exited = true;
        resolve();
      })
    );
    terminal.onData((chunk) => {
      output = (output + chunk).slice(-256_000);
    });
    const stop = ownCleanup(async () => {
      if (!exited) terminal.kill('SIGTERM');
      await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, 3000))]);
      if (!exited) terminal.kill('SIGKILL');
      await exit;
    });
    try {
      await waitFor(() => output.includes(handshake.marker), 'TUI composer not ready');
      await writeBracketedPaste(terminal, input.prompt);
      await waitFor(
        () => output.includes('Call Read'),
        'Prompt did not reach composer'
      );
      terminal.write('\r');
      await waitFor(finalized, 'TUI turn did not complete');
      await waitFor(() => output.includes(input.marker), 'TUI omitted final result');
      assert(!output.includes(controls));
    } finally {
      await stop();
    }
  } else {
    const reserve = createServer();
    await new Promise<void>((resolve) => reserve.listen(0, '127.0.0.1', resolve));
    const address = reserve.address();
    assert(address && typeof address !== 'string');
    const port = address.port;
    await new Promise<void>((resolve) => reserve.close(() => resolve()));
    const process = await launch(['serve', '--port', String(port)]);
    const origin = `http://127.0.0.1:${port}`;
    const requestState = { refreshing: false, closing: false };
    let stopBrowser: (() => Promise<void>) | undefined;
    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath: input.browserExecutable,
      });
      stopBrowser = ownCleanup(async () => {
        requestState.closing = true;
        await browser.close();
      });
      await waitFor(
        async () =>
          fetch(`${origin}/health`).then(
            (r) => r.ok,
            () => false
          ),
        'Web server not ready'
      );
      const created = await fetch(`${origin}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: input.workspace,
          title: 'Textual tool recovery',
          permissionMode: 'yolo',
        }),
      });
      assert(created.ok);
      sessionId = SessionSchema.parse(await created.json()).sessionId;
      const page = await browser.newPage();
      page.on('pageerror', (error) => faults.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') faults.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 400) faults.push(`HTTP ${response.status()}`);
      });
      page.on('requestfailed', (request) => {
        if (
          !isExpectedBrowserRequestFailure({
            url: request.url(),
            resourceType: request.resourceType(),
            errorText: request.failure()?.errorText ?? '',
            ...requestState,
          })
        )
          faults.push('request failed');
      });
      await page.goto(
        `${origin}/?${new URLSearchParams({ session: sessionId, project: input.workspace })}`
      );
      const composer = page.locator('textarea[data-blade-composer]');
      await composer.waitFor({ state: 'visible', timeout: 30000 });
      await composer.fill(input.prompt);
      await composer.press('Enter');
      await waitFor(finalized, 'Web turn did not complete');
      const final = page
        .locator('[data-chat-role="assistant"]')
        .filter({ hasText: input.marker })
        .last();
      const assertCompletedView = async () => {
        await final.waitFor({ state: 'visible', timeout: 30000 });
        await page
          .getByRole('button', {
            name: /^(?:选择「Textual tool recovery」|Select Textual tool recovery)$/,
          })
          .locator('[title="completed"]')
          .waitFor({ state: 'visible', timeout: 30000 });
        assert.equal(
          await page
            .getByRole('button', {
              name: /^(?:停止「Textual tool recovery」|Stop Textual tool recovery)$/,
            })
            .count(),
          0
        );
        const groups = page.locator('[data-agent-tool-group] > button');
        for (const group of await groups.all()) {
          if ((await group.getAttribute('aria-expanded')) !== 'true')
            await group.click();
        }
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              '[data-tool-name="Read"][data-tool-status="success"]'
            ).length === 1 &&
            document.querySelectorAll('[data-tool-status="running"]').length === 0,
          undefined,
          { timeout: 30000 }
        );
        assert.equal(await page.locator('[data-tool-name]').count(), 1);
        assert(!(await page.locator('body').innerText()).includes(controls));
      };
      await assertCompletedView();
      await page.screenshot({
        path: path.join(input.workspace, 'textual-tool-recovered.png'),
        fullPage: true,
      });
      requestState.refreshing = true;
      await page.reload();
      requestState.refreshing = false;
      await assertCompletedView();
    } finally {
      try {
        await stopBrowser?.();
      } finally {
        await process.stop();
      }
    }
  }
  assert.deepEqual(faults, []);
  console.log(
    JSON.stringify({
      surface: input.surface,
      sessionId,
      markerVisible: true,
      internalControlHidden: true,
      faults,
    })
  );
}

try {
  await run();
} finally {
  await Promise.all([...cleanups].map((stop) => stop()));
}
