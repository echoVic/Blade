import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import lockfile from 'proper-lockfile';
import {
  type AcpRemoteStateScope,
  assertAcpRemoteStateFile,
} from '../../acp/AcpRemoteWorkspace.js';
import {
  getAcpRemoteSessionLeaseFilePath,
  getProjectStoragePath,
} from '../../context/storage/pathUtils.js';
import {
  type SessionStateStorage,
  withSessionStateRoot,
} from '../../context/storage/SessionStateStorage.js';
import { getCwd } from '../../utils/cwd.js';
import {
  captureProcessIdentity,
  isProcessIdentity,
  type ProcessIdentity,
} from '../../utils/process/ProcessIdentity.js';

const SESSION_LEASE_VERSION = 1;

interface SessionLeaseRecord {
  version: typeof SESSION_LEASE_VERSION;
  sessionId: string;
  ownerId: string;
  pid: number;
  processIdentity?: ProcessIdentity;
  acquiredAt: string;
}

function leasePath(projectPath: string, sessionId: string): string {
  const digest = createHash('sha256').update(sessionId).digest('hex');
  return path.join(getProjectStoragePath(projectPath), '.locks', `${digest}.lock`);
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

async function readLease(filePath: string): Promise<SessionLeaseRecord | undefined> {
  try {
    const value = JSON.parse(
      await fs.readFile(filePath, 'utf8')
    ) as Partial<SessionLeaseRecord>;
    if (
      value.version !== SESSION_LEASE_VERSION ||
      typeof value.sessionId !== 'string' ||
      typeof value.ownerId !== 'string' ||
      !Number.isInteger(value.pid) ||
      (value.pid ?? 0) <= 0 ||
      (value.processIdentity !== undefined &&
        !isProcessIdentity(value.processIdentity)) ||
      typeof value.acquiredAt !== 'string'
    ) {
      return undefined;
    }
    return value as SessionLeaseRecord;
  } catch (error) {
    if (isNodeError(error, 'ENOENT') || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function readLeaseAfterCreate(
  filePath: string
): Promise<SessionLeaseRecord | undefined> {
  const initial = await readLease(filePath);
  if (initial) return initial;
  await new Promise((resolve) => setTimeout(resolve, 10));
  return readLease(filePath);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNodeError(error, 'ESRCH');
  }
}

async function tryCreateExclusive(
  filePath: string,
  record: SessionLeaseRecord
): Promise<boolean> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
    return true;
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) return false;
    if (handle) {
      await fs.unlink(filePath).catch(() => undefined);
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export class SessionInUseError extends Error {
  readonly code = 'BLADE_SESSION_IN_USE';

  constructor(ownerPid?: number) {
    super(
      ownerPid
        ? `Session is already active in another Blade process (PID ${ownerPid}). Stop that process or choose a different session.`
        : 'Session is already active in another Blade process. Stop that process or choose a different session.'
    );
    this.name = 'SessionInUseError';
  }
}

async function withLeaseRecordLock<T>(
  filePath: string,
  operation: (assertHeld: () => void) => Promise<T>,
  wait = false
): Promise<T> {
  let compromised: Error | undefined;
  let release: () => Promise<void>;
  try {
    release = await lockfile.lock(filePath, {
      realpath: false,
      retries: wait ? { retries: 50, minTimeout: 10, maxTimeout: 100, factor: 1.2 } : 0,
      onCompromised: (error) => {
        compromised = error;
      },
    });
  } catch (error) {
    if (isNodeError(error, 'ELOCKED')) throw new SessionInUseError();
    throw error;
  }
  const assertHeld = () => {
    if (compromised) throw compromised;
  };
  try {
    assertHeld();
    const result = await operation(assertHeld);
    assertHeld();
    return result;
  } finally {
    await release();
  }
}

export class SessionLease {
  private released = false;

  private constructor(
    private readonly filePath: string,
    private readonly record: SessionLeaseRecord,
    private readonly stateStorage?: SessionStateStorage
  ) {}

  static async acquireForStorage(
    sessionId: string,
    storage: SessionStateStorage
  ): Promise<SessionLease> {
    if (storage.kind === 'local') {
      return SessionLease.acquire(sessionId, storage.root);
    }
    return withSessionStateRoot(storage, (root, scope) => {
      if (!scope || root !== storage.root) {
        throw new Error('ACP remote session lease scope is invalid');
      }
      return SessionLease.acquireRemote(sessionId, scope, storage);
    });
  }

  static async acquire(
    sessionId: string,
    projectPath: string = getCwd()
  ): Promise<SessionLease> {
    return SessionLease.acquireAtPath(sessionId, leasePath(projectPath, sessionId));
  }

  static async acquireRemote(
    sessionId: string,
    scope: AcpRemoteStateScope,
    stateStorage?: SessionStateStorage
  ): Promise<SessionLease> {
    const filePath = getAcpRemoteSessionLeaseFilePath(scope, sessionId);
    try {
      await assertAcpRemoteStateFile(scope, filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const lease = await SessionLease.acquireAtPath(sessionId, filePath);
    try {
      await assertAcpRemoteStateFile(scope, filePath);
      return new SessionLease(filePath, lease.record, stateStorage);
    } catch (error) {
      await lease.release();
      throw error;
    }
  }

  private static async acquireAtPath(
    sessionId: string,
    filePath: string
  ): Promise<SessionLease> {
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    return withLeaseRecordLock(filePath, async (assertHeld) => {
      const record: SessionLeaseRecord = {
        version: SESSION_LEASE_VERSION,
        sessionId,
        ownerId: randomUUID(),
        pid: process.pid,
        processIdentity: captureProcessIdentity(process.pid),
        acquiredAt: new Date().toISOString(),
      };
      assertHeld();
      if (await tryCreateExclusive(filePath, record)) {
        return new SessionLease(filePath, record);
      }

      const existing = await readLeaseAfterCreate(filePath);
      if (!existing || existing.sessionId !== sessionId) throw new SessionInUseError();
      if (isProcessRunning(existing.pid)) {
        const identity = existing.processIdentity
          ? captureProcessIdentity(existing.pid, existing.processIdentity.platform)
          : undefined;
        if (
          !identity ||
          identity.fingerprint === existing.processIdentity?.fingerprint
        ) {
          throw new SessionInUseError(existing.pid);
        }
      }

      assertHeld();
      await fs.unlink(filePath).catch((error) => {
        if (!isNodeError(error, 'ENOENT')) throw error;
      });
      assertHeld();
      if (await tryCreateExclusive(filePath, record)) {
        return new SessionLease(filePath, record);
      }

      throw new SessionInUseError((await readLeaseAfterCreate(filePath))?.pid);
    });
  }

  async release(): Promise<void> {
    if (this.released) return;
    const release = () =>
      withLeaseRecordLock(
        this.filePath,
        async (assertHeld) => {
          const current = await readLease(this.filePath);
          if (current?.ownerId !== this.record.ownerId) return;
          assertHeld();
          await fs.unlink(this.filePath).catch((error) => {
            if (!isNodeError(error, 'ENOENT')) throw error;
          });
        },
        true
      );
    if (this.stateStorage?.kind === 'acp-remote') {
      await withSessionStateRoot(this.stateStorage, release);
    } else {
      await release();
    }
    this.released = true;
  }
}
