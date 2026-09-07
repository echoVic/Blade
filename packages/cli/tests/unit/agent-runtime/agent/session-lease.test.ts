import * as childProcessModule from 'node:child_process';
import { type ChildProcess, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import * as fsModule from 'node:fs';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAcpRemotePathProfile } from '../../../../src/acp/AcpRemotePath.js';
import {
  createAcpRemoteWorkspaceDescriptor,
  deriveAcpRemoteHostStateRoot,
  ensureAcpRemoteHostStateRoot,
  withValidatedAcpRemoteStateScope,
} from '../../../../src/acp/AcpRemoteWorkspace.js';
import { SessionLease } from '../../../../src/agent/runtime/SessionLease.js';
import {
  getAcpRemoteSessionLeaseFilePath,
  getProjectStoragePath,
} from '../../../../src/context/storage/pathUtils.js';
import { createRemoteSessionStateStorage } from '../../../../src/context/storage/SessionStateStorage.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

describe('SessionLease', () => {
  let storageRoot: string;
  let projectPath: string;
  const children = new Set<ChildProcess>();

  beforeAll(async () => {
    const childProcess =
      await vi.importActual<typeof import('node:child_process')>('node:child_process');
    vi.mocked(spawn).mockImplementation(childProcess.spawn);
  });

  async function waitForFile(
    filePath: string,
    child: ChildProcess,
    timeoutMs = 5_000
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const exited = once(child, 'exit').then(() => 'exit' as const);
    for (;;) {
      if (existsSync(filePath)) return;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error('Lease holder exited before ready');
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Lease holder ready timeout');
      const outcome = await Promise.race([
        exited,
        new Promise<'tick'>((resolve) =>
          setTimeout(() => resolve('tick'), Math.min(25, remaining))
        ),
      ]);
      if (outcome === 'exit') throw new Error('Lease holder exited before ready');
    }
  }

  async function terminateChild(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
  }

  beforeEach(() => {
    storageRoot = mkdtempSync(path.join(os.tmpdir(), 'blade-session-lease-'));
    projectPath = path.join(storageRoot, 'workspace');
    mkdirSync(projectPath, { recursive: true });
    vi.stubEnv('BLADE_STORAGE_ROOT', storageRoot);
  });

  afterEach(async () => {
    await Promise.all(Array.from(children, terminateChild));
    children.clear();
    vi.unstubAllEnvs();
    rmSync(storageRoot, { recursive: true, force: true });
  });

  function getLeasePath(sessionId: string): string {
    const digest = createHash('sha256').update(sessionId).digest('hex');
    return path.join(getProjectStoragePath(projectPath), '.locks', `${digest}.lock`);
  }

  it('recovers a lease owned by a process that no longer exists', async () => {
    const sessionId = 'stale-session';
    const lockPath = getLeasePath(sessionId);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        version: 1,
        sessionId,
        ownerId: 'dead-owner',
        pid: 2_147_483_647,
        acquiredAt: '2026-01-01T00:00:00.000Z',
      })}\n`
    );

    const lease = await SessionLease.acquire(sessionId, projectPath);

    await expect(lease.release()).resolves.toBeUndefined();
  });

  it('stores remote session leases directly inside a validated protected scope', async () => {
    const descriptor = createAcpRemoteWorkspaceDescriptor(
      createAcpRemotePathProfile('C:\\Repo')
    );
    const hostStateRoot = deriveAcpRemoteHostStateRoot(descriptor.collisionIdentity);
    const sessionId = 'remote-lease-session';

    await ensureAcpRemoteHostStateRoot(hostStateRoot);
    await withValidatedAcpRemoteStateScope(hostStateRoot, async (scope) => {
      const lockPath = getAcpRemoteSessionLeaseFilePath(scope, sessionId);
      const lease = await SessionLease.acquireRemote(sessionId, scope);
      expect(existsSync(lockPath)).toBe(true);
      await lease.release();
      expect(existsSync(lockPath)).toBe(false);
    });

    expect(existsSync(getProjectStoragePath(hostStateRoot))).toBe(false);
  });

  it('revalidates the remote state scope before releasing a lease', async () => {
    if (process.platform === 'win32') return;

    const descriptor = createAcpRemoteWorkspaceDescriptor(
      createAcpRemotePathProfile('C:\\Remote\\Lease')
    );
    const hostStateRoot = deriveAcpRemoteHostStateRoot(descriptor.collisionIdentity);
    const sessionId = 'remote-lease-release-gate';
    const stateStorage = createRemoteSessionStateStorage(hostStateRoot, descriptor);

    await ensureAcpRemoteHostStateRoot(hostStateRoot);
    const lease = await SessionLease.acquireForStorage(sessionId, stateStorage);
    chmodSync(hostStateRoot, 0o755);

    await expect(lease.release()).rejects.toMatchObject({
      code: 'acp_remote_workspace_state_invalid',
    });
    chmodSync(hostStateRoot, 0o700);
    await withValidatedAcpRemoteStateScope(hostStateRoot, async (scope) => {
      expect(existsSync(getAcpRemoteSessionLeaseFilePath(scope, sessionId))).toBe(true);
    });
    await expect(lease.release()).resolves.toBeUndefined();
    await withValidatedAcpRemoteStateScope(hostStateRoot, async (scope) => {
      expect(existsSync(getAcpRemoteSessionLeaseFilePath(scope, sessionId))).toBe(
        false
      );
    });
  });

  it('rejects a symlinked remote session lease without following or deleting it', async () => {
    if (process.platform === 'win32') return;

    const descriptor = createAcpRemoteWorkspaceDescriptor(
      createAcpRemotePathProfile('C:\\Repo')
    );
    const hostStateRoot = deriveAcpRemoteHostStateRoot(descriptor.collisionIdentity);
    const sessionId = 'remote-symlink-lease';
    const outsideLease = path.join(storageRoot, 'outside-lease.json');
    const outsideContent = `${JSON.stringify({
      version: 1,
      sessionId,
      ownerId: 'outside-owner',
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    })}\n`;
    writeFileSync(outsideLease, outsideContent);

    await ensureAcpRemoteHostStateRoot(hostStateRoot);
    await withValidatedAcpRemoteStateScope(hostStateRoot, async (scope) => {
      const lockPath = getAcpRemoteSessionLeaseFilePath(scope, sessionId);
      symlinkSync(outsideLease, lockPath);

      await expect(SessionLease.acquireRemote(sessionId, scope)).rejects.toMatchObject({
        code: 'acp_remote_workspace_state_invalid',
      });
      expect(readFileSync(outsideLease, 'utf8')).toBe(outsideContent);
      expect(existsSync(lockPath)).toBe(true);
    });
  });

  it('recovers a reused live PID when the process identity changed', async () => {
    const sessionId = 'reused-pid-session';
    const lockPath = getLeasePath(sessionId);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        version: 1,
        sessionId,
        ownerId: 'reused-owner',
        pid: process.pid,
        processIdentity: {
          platform: process.platform,
          fingerprint: '0'.repeat(64),
        },
        acquiredAt: '2026-01-01T00:00:00.000Z',
      })}\n`
    );

    const lease = await SessionLease.acquire(sessionId, projectPath);

    await expect(lease.release()).resolves.toBeUndefined();
  });

  it('grants only one lease when stale-owner reclamations race', async () => {
    const sessionId = 'concurrent-stale-owner';
    const lockPath = getLeasePath(sessionId);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        version: 1,
        sessionId,
        ownerId: 'stale-owner',
        pid: 2_147_483_647,
        acquiredAt: '2026-01-01T00:00:00.000Z',
      })}\n`
    );

    const read =
      await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const observed = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    let paused = false;
    const probe = vi
      .spyOn(fsPromises, 'readFile')
      .mockImplementation(async (file, options) => {
        const content = await read.readFile(file, options);
        if (file === lockPath && !paused) {
          paused = true;
          observed.resolve();
          await resume.promise;
        }
        return content;
      });
    const first = Promise.allSettled([SessionLease.acquire(sessionId, projectPath)]);
    const acquired: SessionLease[] = [];
    try {
      await observed.promise;
      const second = await Promise.allSettled([
        SessionLease.acquire(sessionId, projectPath),
      ]);
      resume.resolve();
      const results = [...(await first), ...second];
      for (const result of results) {
        if (result.status === 'fulfilled') acquired.push(result.value);
        else expect(result.reason).toMatchObject({ code: 'BLADE_SESSION_IN_USE' });
      }
      expect(acquired).toHaveLength(1);
    } finally {
      resume.resolve();
      probe.mockRestore();
      await Promise.all(acquired.map((lease) => lease.release()));
    }
  });

  it('does not reclaim a live lease when process identity sampling fails', async () => {
    const sessionId = 'unavailable-identity';
    const lockPath = getLeasePath(sessionId);
    const original = await SessionLease.acquire(sessionId, projectPath);
    const before = readFileSync(lockPath, 'utf8');
    expect(JSON.parse(before)).toHaveProperty('processIdentity.fingerprint');
    const failedProbe = () => {
      throw new Error('identity probe unavailable');
    };
    const probe =
      process.platform === 'linux'
        ? vi.spyOn(fsModule, 'readFileSync').mockImplementation(failedProbe)
        : vi.spyOn(childProcessModule, 'execFileSync').mockImplementation(failedProbe);
    let contender: SessionLease | undefined;
    try {
      await expect(
        SessionLease.acquire(sessionId, projectPath).then((lease) => {
          contender = lease;
          return lease;
        })
      ).rejects.toMatchObject({ code: 'BLADE_SESSION_IN_USE' });
    } finally {
      probe.mockRestore();
      await contender?.release();
      await original.release();
    }
  });

  it('propagates unreadable lease state instead of deleting it', async () => {
    const sessionId = 'unreadable-lease';
    const lockPath = getLeasePath(sessionId);
    const original = await SessionLease.acquire(sessionId, projectPath);
    const read =
      await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const denied = Object.assign(new Error('lease read denied'), { code: 'EACCES' });
    const probe = vi
      .spyOn(fsPromises, 'readFile')
      .mockImplementation((file, options) => {
        if (file === lockPath) return Promise.reject(denied);
        return read.readFile(file, options);
      });
    let contender: SessionLease | undefined;
    try {
      await expect(
        SessionLease.acquire(sessionId, projectPath).then((lease) => {
          contender = lease;
          return lease;
        })
      ).rejects.toMatchObject({ code: 'EACCES' });
    } finally {
      probe.mockRestore();
      await contender?.release();
      await original.release();
    }
  });

  it('fails closed on a malformed lease record', async () => {
    const sessionId = 'malformed-lease';
    const lockPath = getLeasePath(sessionId);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, '{partial');
    let contender: SessionLease | undefined;
    try {
      await expect(
        SessionLease.acquire(sessionId, projectPath).then((lease) => {
          contender = lease;
          return lease;
        })
      ).rejects.toMatchObject({ code: 'BLADE_SESSION_IN_USE' });
      expect(readFileSync(lockPath, 'utf8')).toBe('{partial');
    } finally {
      await contender?.release();
    }
  });

  it('does not treat unexpected liveness errors as an exited owner', async () => {
    const sessionId = 'unknown-liveness';
    const original = await SessionLease.acquire(sessionId, projectPath);
    const probe = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('liveness unavailable'), { code: 'EIO' });
    });
    let contender: SessionLease | undefined;
    try {
      await expect(
        SessionLease.acquire(sessionId, projectPath).then((lease) => {
          contender = lease;
          return lease;
        })
      ).rejects.toMatchObject({ code: 'BLADE_SESSION_IN_USE' });
    } finally {
      probe.mockRestore();
      await contender?.release();
      await original.release();
    }
  });

  it('excludes acquisition while a release is reading its owner record', async () => {
    const sessionId = 'release-record-lock';
    const original = await SessionLease.acquire(sessionId, projectPath);
    const read =
      await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const observed = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    let reads = 0;
    const probe = vi
      .spyOn(fsPromises, 'readFile')
      .mockImplementation(async (file, options) => {
        const content = await read.readFile(file, options);
        if (file === getLeasePath(sessionId)) {
          reads++;
          if (reads === 1) {
            observed.resolve();
            await resume.promise;
          }
        }
        return content;
      });
    const releasing = original.release();
    try {
      await observed.promise;
      await expect(SessionLease.acquire(sessionId, projectPath)).rejects.toMatchObject({
        code: 'BLADE_SESSION_IN_USE',
      });
      expect(reads).toBe(1);
    } finally {
      resume.resolve();
      await releasing;
      probe.mockRestore();
    }
  });

  it('does not remove a replacement lease owned by another runtime', async () => {
    const sessionId = 'replacement-session';
    const lockPath = getLeasePath(sessionId);
    const original = await SessionLease.acquire(sessionId, projectPath);
    const replacementOwner = 'replacement-owner';
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        version: 1,
        sessionId,
        ownerId: replacementOwner,
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      })}\n`
    );

    await original.release();

    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, 'utf8')).toContain(replacementOwner);
  });

  it('grants a stale session to only one of four independent processes', async () => {
    const sessionId = 'cross-process-reclamation';
    const lockPath = getLeasePath(sessionId);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      JSON.stringify({
        version: 1,
        sessionId,
        ownerId: 'exited-owner',
        pid: 2_147_483_647,
        acquiredAt: '2026-01-01T00:00:00.000Z',
      })
    );
    const attempts = Array.from({ length: 4 }, (_, index) => {
      const readyPath = path.join(storageRoot, `contender-${index}.ready`);
      const child = spawn(
        process.env.BUN_EXEC_PATH ?? 'bun',
        [
          path.resolve(import.meta.dirname, '../../../fixtures/hold-session-lease.ts'),
          sessionId,
          projectPath,
          readyPath,
        ],
        {
          env: { ...process.env, BLADE_STORAGE_ROOT: storageRoot },
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      children.add(child);
      let output = '';
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });
      return waitForFile(readyPath, child).then(
        () => true,
        () => {
          expect(output).toContain('SessionInUseError');
          return false;
        }
      );
    });
    expect((await Promise.all(attempts)).filter(Boolean)).toHaveLength(1);
  });

  it('enforces session ownership across processes and releases on child exit', async () => {
    const sessionId = 'cross-process-session';
    const readyPath = path.join(storageRoot, 'lease-holder.ready');
    const fixturePath = path.resolve(
      import.meta.dirname,
      '../../../fixtures/hold-session-lease.ts'
    );
    const child = spawn(
      process.env.BUN_EXEC_PATH ?? 'bun',
      [fixturePath, sessionId, projectPath, readyPath],
      {
        env: { ...process.env, BLADE_STORAGE_ROOT: storageRoot },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    children.add(child);

    await waitForFile(readyPath, child);
    await expect(SessionLease.acquire(sessionId, projectPath)).rejects.toMatchObject({
      name: 'SessionInUseError',
      code: 'BLADE_SESSION_IN_USE',
    });

    const exited = once(child, 'exit');
    child.stdin?.end();
    await exited;
    children.delete(child);

    const replacement = await SessionLease.acquire(sessionId, projectPath);
    await replacement.release();
    expect(existsSync(getLeasePath(sessionId))).toBe(false);
  });
});
