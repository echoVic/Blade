import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionFilePath } from '../../../../src/context/storage/pathUtils.js';
import {
  getProjectionDb,
  readSessionSurfaceCandidates,
  resetProjectionDbCache,
  searchProjectionText,
  syncAll,
  syncSession,
} from '../../../../src/context/storage/sqlite/projection.js';
import { migrate } from '../../../../src/context/storage/sqlite/schema.js';
import type {
  SessionEvent,
  SessionTaskPriority,
  SessionTaskStatus,
} from '../../../../src/context/types.js';
import { SessionService } from '../../../../src/services/SessionService.js';
import { searchTranscripts } from '../../../../src/services/TranscriptSearch.js';

const ts = (s: number) => new Date(Date.UTC(2024, 0, 1, 0, 0, s)).toISOString();

interface TaskFixture {
  status?: SessionTaskStatus;
  priority?: SessionTaskPriority;
  dueAt?: string;
}

function ev(
  seq: number,
  type: SessionEvent['type'],
  data: unknown,
  at: string,
  cwd: string
): SessionEvent {
  return {
    seq,
    id: `e${seq}-${Math.random()}`,
    sessionId: 's',
    projectPath: cwd,
    timestamp: at,
    type,
    cwd,
    version: 'test',
    data,
  } as SessionEvent;
}

describe('SQLite read-model parity + FTS search', () => {
  let root: string;
  let projectPath: string;

  function escaped(p: string): string {
    return p.replace(/[/\\]/g, '-').replace(/:/g, '_');
  }
  async function writeSession(
    sessionId: string,
    userText: string,
    assistantText: string,
    at: string,
    task?: TaskFixture
  ): Promise<void> {
    const dir = path.join(root, 'projects', escaped(projectPath));
    await mkdir(dir, { recursive: true });
    const events: SessionEvent[] = [
      ev(
        1,
        'session_created',
        {
          sessionId,
          rootId: sessionId,
          createdAt: at,
          updatedAt: at,
          ...(task?.status ? { taskStatus: task.status } : {}),
          ...(task?.priority ? { taskPriority: task.priority } : {}),
          ...(task?.dueAt ? { taskDueAt: task.dueAt } : {}),
        },
        at,
        projectPath
      ),
      ev(
        2,
        'message_created',
        { messageId: 'u1', role: 'user', createdAt: at },
        at,
        projectPath
      ),
      ev(
        3,
        'part_created',
        {
          partId: 'pu1',
          messageId: 'u1',
          partType: 'text',
          payload: { text: userText },
          createdAt: at,
        },
        at,
        projectPath
      ),
      ev(
        4,
        'message_created',
        { messageId: 'a1', role: 'assistant', parentMessageId: 'u1', createdAt: at },
        at,
        projectPath
      ),
      ev(
        5,
        'part_created',
        {
          partId: 'pa1',
          messageId: 'a1',
          partType: 'text',
          payload: { text: assistantText },
          createdAt: at,
        },
        at,
        projectPath
      ),
    ].map((e) => ({ ...e, sessionId }));
    await writeFile(
      path.join(dir, `${sessionId}.jsonl`),
      `${events.map((e) => JSON.stringify(e)).join('\n')}\n`,
      'utf8'
    );
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'blade-parity-'));
    process.env.BLADE_STORAGE_ROOT = root;
    projectPath = path.join(root, 'workspace');
    await mkdir(projectPath, { recursive: true });
    resetProjectionDbCache();
  });

  afterEach(async () => {
    resetProjectionDbCache();
    delete process.env.BLADE_STORAGE_ROOT;
    await rm(root, { recursive: true, force: true });
  });

  it('listSessions (SQLite path) returns the expected sessions in sorted order', async () => {
    await writeSession('sess-old', 'hi', 'older answer', ts(1));
    await writeSession('sess-new', 'hi', 'newer answer', ts(5));

    const sessions = await SessionService.listSessions({ cwd: projectPath });
    expect(sessions.map((s) => s.sessionId)).toEqual(['sess-new', 'sess-old']);
    expect(sessions[0]).toMatchObject({ projectPath, sessionId: 'sess-new' });
  });

  it('searchTranscripts finds cross-session content via FTS', async () => {
    await writeSession('sess-a', 'question about tides', 'oceans have tides', ts(1));
    await writeSession('sess-b', 'unrelated', 'nothing here', ts(2));

    const matches = await searchTranscripts('tides', { projectPath });
    const ids = new Set(matches.map((m) => m.sessionId));
    expect(ids.has('sess-a')).toBe(true);
    // 'tides' appears in sess-a user + assistant; sess-b has none.
    expect(matches.every((m) => m.sessionId === 'sess-a')).toBe(true);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('reflects a deleted session (GC) on next list', async () => {
    await writeSession('sess-x', 'hi', 'answer', ts(1));
    expect((await SessionService.listSessions({ cwd: projectPath })).length).toBe(1);

    await SessionService.deleteSession('sess-x', projectPath);
    expect((await SessionService.listSessions({ cwd: projectPath })).length).toBe(0);
  });

  it.each(['team-project', 'team_project'])(
    'keeps cold and warm projection identities for %s until the transcript is deleted',
    async (directory) => {
      projectPath = path.join(root, directory);
      await mkdir(projectPath, { recursive: true });
      await writeSession(
        'ambiguous-path',
        'identityneedle question',
        'identityneedle answer',
        ts(1)
      );
      const transcriptPath = getSessionFilePath(projectPath, 'ambiguous-path');
      const originalTranscript = await readFile(transcriptPath, 'utf8');
      const db = await getProjectionDb();
      if (!db) throw new Error('SQLite is unavailable');
      const derive = SessionService.projectionDeriverForSearch();
      await syncAll(db, derive);
      db.exec('PRAGMA user_version=7');
      migrate(db);
      await syncAll(db, derive);
      expect(await readFile(transcriptPath, 'utf8')).toBe(originalTranscript);
      expect(readSessionSurfaceCandidates(db, 'ambiguous-path')).toMatchObject([
        { projectPath, sessionId: 'ambiguous-path' },
      ]);
      await syncSession(db, 'ambiguous-path', projectPath, derive);
      await syncAll(db, derive);
      await syncAll(db, derive);
      expect(readSessionSurfaceCandidates(db, 'ambiguous-path')).toMatchObject([
        { projectPath, sessionId: 'ambiguous-path' },
      ]);
      expect(await searchTranscripts('identityneedle', { projectPath })).toHaveLength(
        2
      );
      await expect(
        SessionService.listSessionArchiveMembers('ambiguous-path', projectPath)
      ).resolves.toMatchObject([{ projectPath, sessionId: 'ambiguous-path' }]);
      await rm(getSessionFilePath(projectPath, 'ambiguous-path'));
      await syncAll(db, derive);
      expect(readSessionSurfaceCandidates(db, 'ambiguous-path')).toEqual([]);
      expect(await searchTranscripts('identityneedle', { projectPath })).toEqual([]);
      expect(
        db.prepare('SELECT COUNT(*) c FROM sessions').get<{ c: number }>()?.c
      ).toBe(0);
      expect(
        db.prepare('SELECT COUNT(*) c FROM projection_state').get<{ c: number }>()?.c
      ).toBe(0);
    }
  );

  it('does not prune a valid direct-sync row using a decoded directory alias', async () => {
    projectPath = path.join(root, 'team-project');
    await mkdir(projectPath, { recursive: true });
    await writeSession('warm-alias', 'warmneedle question', 'warmneedle answer', ts(1));
    const db = await getProjectionDb();
    if (!db) throw new Error('SQLite is unavailable');
    const derive = SessionService.projectionDeriverForSearch();
    await syncSession(db, 'warm-alias', projectPath, derive);
    expect(readSessionSurfaceCandidates(db, 'warm-alias')).toHaveLength(1);
    await syncAll(db, derive);
    expect(readSessionSurfaceCandidates(db, 'warm-alias')).toHaveLength(1);
    expect(await searchTranscripts('warmneedle', { projectPath })).toHaveLength(2);
  });

  it('does not rederive unchanged sources across direct and catalog sync', async () => {
    projectPath = path.join(root, 'warm-project_with_underscore');
    await mkdir(projectPath, { recursive: true });
    await writeSession('warm-gate', 'warmgate', 'warmgate answer', ts(1));
    const db = await getProjectionDb();
    if (!db) throw new Error('SQLite is unavailable');
    const derive = vi.fn(SessionService.projectionDeriverForSearch());
    await syncAll(db, derive);
    const calls = derive.mock.calls.length;
    expect(calls).toBe(1);
    await syncAll(db, derive);
    await syncSession(db, 'warm-gate', projectPath, derive);
    await syncAll(db, derive);
    expect(derive).toHaveBeenCalledTimes(calls);
    expect(readSessionSurfaceCandidates(db, 'warm-gate')).toHaveLength(1);
  });

  it.each(['deleted', 'invalid'] as const)(
    'restores the surviving source in one sync when a duplicate winner is %s',
    async (change) => {
      await writeSession('duplicate-source', 'oldsource', 'oldsource answer', ts(1));
      const canonical = getSessionFilePath(projectPath, 'duplicate-source');
      const olderDirectory = path.join(root, 'projects', 'older-copy');
      const newerDirectory = path.join(root, 'projects', 'newer-copy');
      await mkdir(olderDirectory, { recursive: true });
      await mkdir(newerDirectory, { recursive: true });
      const olderFile = path.join(olderDirectory, 'duplicate-source.jsonl');
      const newerFile = path.join(newerDirectory, 'duplicate-source.jsonl');
      await writeFile(olderFile, await readFile(canonical, 'utf8'));
      await writeSession('duplicate-source', 'newsource', 'newsource answer', ts(2));
      await writeFile(newerFile, await readFile(canonical, 'utf8'));
      await rm(canonical);
      const db = await getProjectionDb();
      if (!db) throw new Error('SQLite is unavailable');
      const derive = SessionService.projectionDeriverForSearch();
      await syncAll(db, derive);
      expect(await searchTranscripts('newsource', { projectPath })).toHaveLength(2);
      expect(await searchTranscripts('oldsource', { projectPath })).toHaveLength(0);
      if (change === 'deleted') await rm(newerFile);
      else await writeFile(newerFile, '');
      await syncAll(db, derive);
      expect(searchProjectionText(db, 'newsource', projectPath, 10)).toHaveLength(0);
      expect(searchProjectionText(db, 'oldsource', projectPath, 10)).toHaveLength(2);
      expect(readSessionSurfaceCandidates(db, 'duplicate-source')).toHaveLength(1);
      await rm(olderFile);
      await syncAll(db, derive);
      expect(await searchTranscripts('oldsource', { projectPath })).toHaveLength(0);
    }
  );

  it.each(['deleted', 'invalid'] as const)(
    'selects the newest of several surviving sources after the winner is %s',
    async (change) => {
      const db = await getProjectionDb();
      if (!db) throw new Error('SQLite is unavailable');
      const derive = SessionService.projectionDeriverForSearch();
      const sourceFiles: string[] = [];
      for (const [index, text] of ['oldcopy', 'middlecopy', 'winningcopy'].entries()) {
        await writeSession('multiple-sources', text, `${text} answer`, ts(index + 1));
        const directory = path.join(root, 'projects', `copy-${index}`);
        await mkdir(directory, { recursive: true });
        const file = path.join(directory, 'multiple-sources.jsonl');
        await writeFile(
          file,
          await readFile(getSessionFilePath(projectPath, 'multiple-sources'), 'utf8')
        );
        sourceFiles.push(file);
      }
      await rm(getSessionFilePath(projectPath, 'multiple-sources'));
      await syncAll(db, derive);
      if (change === 'deleted') await rm(sourceFiles[2]!);
      else await writeFile(sourceFiles[2]!, '');
      await syncAll(db, derive);
      expect(searchProjectionText(db, 'middlecopy', projectPath, 10)).toHaveLength(2);
      expect(searchProjectionText(db, 'oldcopy', projectPath, 10)).toEqual([]);
      expect(searchProjectionText(db, 'winningcopy', projectPath, 10)).toEqual([]);
      expect(readSessionSurfaceCandidates(db, 'multiple-sources')).toHaveLength(1);
    }
  );

  it('compares all surviving copies after a direct sync removes the winner', async () => {
    const db = await getProjectionDb();
    if (!db) throw new Error('SQLite is unavailable');
    const derive = SessionService.projectionDeriverForSearch();
    const sources: string[] = [];
    for (const [index, text] of ['oldcopy', 'middlecopy', 'winningcopy'].entries()) {
      await writeSession('direct-recovery', text, `${text} answer`, ts(index + 1));
      const directory = path.join(root, 'projects', `source-${index}`);
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, 'direct-recovery.jsonl');
      await writeFile(
        file,
        await readFile(getSessionFilePath(projectPath, 'direct-recovery'), 'utf8')
      );
      sources.push(file);
      await syncSession(db, 'direct-recovery', projectPath, derive, file);
    }
    await rm(getSessionFilePath(projectPath, 'direct-recovery'));
    await rm(sources[2]!);
    await syncSession(db, 'direct-recovery', projectPath, derive, sources[2]);
    await syncSession(db, 'direct-recovery', projectPath, derive, sources[0]);
    await syncSession(db, 'direct-recovery', projectPath, derive, sources[1]);
    expect(searchProjectionText(db, 'middlecopy', projectPath, 10)).toHaveLength(2);
    expect(searchProjectionText(db, 'oldcopy', projectPath, 10)).toEqual([]);
  });

  it('reselects a newer surviving copy when the winner is rewound', async () => {
    const db = await getProjectionDb();
    if (!db) throw new Error('SQLite is unavailable');
    const derive = SessionService.projectionDeriverForSearch();
    const sources: string[] = [];
    for (const [index, text] of ['middlecopy', 'winningcopy'].entries()) {
      await writeSession('rewound-source', text, `${text} answer`, ts(index + 2));
      const directory = path.join(root, 'projects', `rewind-${index}`);
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, 'rewound-source.jsonl');
      await writeFile(
        file,
        await readFile(getSessionFilePath(projectPath, 'rewound-source'), 'utf8')
      );
      sources.push(file);
    }
    await rm(getSessionFilePath(projectPath, 'rewound-source'));
    await syncAll(db, derive);
    expect(searchProjectionText(db, 'winningcopy', projectPath, 10)).toHaveLength(2);
    await writeSession('rewound-source', 'rewoundcopy', 'rewoundcopy answer', ts(1));
    await writeFile(
      sources[1]!,
      await readFile(getSessionFilePath(projectPath, 'rewound-source'), 'utf8')
    );
    await rm(getSessionFilePath(projectPath, 'rewound-source'));
    await syncAll(db, derive);
    expect(searchProjectionText(db, 'middlecopy', projectPath, 10)).toHaveLength(2);
    expect(searchProjectionText(db, 'winningcopy', projectPath, 10)).toEqual([]);
    expect(searchProjectionText(db, 'rewoundcopy', projectPath, 10)).toEqual([]);
  });

  it('removes the previous workspace projection when one source changes identity', async () => {
    const firstWorkspace = path.join(root, 'team-project');
    const nextWorkspace = path.join(root, 'team', 'project');
    await mkdir(firstWorkspace, { recursive: true });
    await mkdir(nextWorkspace, { recursive: true });
    projectPath = firstWorkspace;
    await writeSession('changed-identity', 'oldidentity', 'oldidentity answer', ts(1));
    const sourceFile = getSessionFilePath(projectPath, 'changed-identity');
    const db = await getProjectionDb();
    if (!db) throw new Error('SQLite is unavailable');
    const derive = SessionService.projectionDeriverForSearch();
    await syncAll(db, derive);
    projectPath = nextWorkspace;
    expect(getSessionFilePath(projectPath, 'changed-identity')).toBe(sourceFile);
    await writeSession('changed-identity', 'newidentity', 'newidentity answer', ts(2));
    await syncAll(db, derive);
    expect(readSessionSurfaceCandidates(db, 'changed-identity')).toMatchObject([
      { projectPath: nextWorkspace },
    ]);
    expect(searchProjectionText(db, 'oldidentity', firstWorkspace, 10)).toEqual([]);
    expect(
      db.prepare('SELECT project_path FROM sessions').all<{ project_path: string }>()
    ).toEqual([{ project_path: nextWorkspace }]);
  });

  it('pushes a single taskStatus filter down to the projection', async () => {
    await writeSession('sess-queued', 'q', 'a', ts(1), { status: 'queued' });
    await writeSession('sess-running', 'r', 'a', ts(2), { status: 'running' });
    await writeSession('sess-done', 'd', 'a', ts(3)); // defaults to completed

    const queued = await SessionService.listSessions({
      cwd: projectPath,
      taskStatus: 'queued',
    });
    expect(queued.map((s) => s.sessionId)).toEqual(['sess-queued']);
    expect(queued[0].taskStatus).toBe('queued');
  });

  it('supports a multi-status taskStatus filter', async () => {
    await writeSession('sess-queued', 'q', 'a', ts(1), { status: 'queued' });
    await writeSession('sess-running', 'r', 'a', ts(2), { status: 'running' });
    await writeSession('sess-done', 'd', 'a', ts(3)); // completed

    const active = await SessionService.listSessions({
      cwd: projectPath,
      taskStatus: ['queued', 'running'],
    });
    // Sorted newest-first by lastMessageTime.
    expect(active.map((s) => s.sessionId)).toEqual(['sess-running', 'sess-queued']);
  });

  it('pushes priority and inclusive due-time ranges down to the projection', async () => {
    await writeSession('sess-high-early', 'a', 'a', ts(1), {
      priority: 'high',
      dueAt: '2024-02-01T00:00:00.000Z',
    });
    await writeSession('sess-medium-window', 'b', 'a', ts(2), {
      priority: 'medium',
      dueAt: '2024-03-01T00:00:00.000Z',
    });
    await writeSession('sess-low-late', 'c', 'a', ts(3), {
      priority: 'low',
      dueAt: '2024-04-01T00:00:00.000Z',
    });
    await writeSession('sess-high-no-due', 'd', 'a', ts(4), {
      priority: 'high',
    });

    const filtered = await SessionService.listSessions({
      cwd: projectPath,
      taskPriority: ['high', 'medium'],
      taskDueAfter: '2024-02-01T00:00:00.000Z',
      taskDueBefore: '2024-03-01T08:00:00+08:00',
    });
    expect(filtered.map((session) => session.sessionId)).toEqual([
      'sess-medium-window',
      'sess-high-early',
    ]);
  });

  it('supports priority-only and due-only projection filters', async () => {
    await writeSession('sess-high', 'a', 'a', ts(1), {
      priority: 'high',
      dueAt: '2024-02-01T00:00:00.000Z',
    });
    await writeSession('sess-low', 'b', 'a', ts(2), {
      priority: 'low',
      dueAt: '2024-04-01T00:00:00.000Z',
    });
    await writeSession('sess-unplanned', 'c', 'a', ts(3));

    await expect(
      SessionService.listSessions({
        cwd: projectPath,
        taskPriority: 'high',
      })
    ).resolves.toMatchObject([{ sessionId: 'sess-high', taskPriority: 'high' }]);

    const due = await SessionService.listSessions({
      cwd: projectPath,
      taskDueBefore: '2024-03-01T00:00:00.000Z',
    });
    expect(due.map((session) => session.sessionId)).toEqual(['sess-high']);
  });

  it('applies identical priority and due-time filters on the JSONL fallback', async () => {
    await mkdir(path.join(root, 'index.db'));
    await writeSession('sess-window', 'a', 'a', ts(1), {
      priority: 'medium',
      dueAt: '2024-03-01T00:00:00.000Z',
    });
    await writeSession('sess-outside', 'b', 'a', ts(2), {
      priority: 'low',
      dueAt: '2024-04-01T00:00:00.000Z',
    });
    await writeSession('sess-no-due', 'c', 'a', ts(3), {
      priority: 'medium',
    });

    const filtered = await SessionService.listSessions({
      cwd: projectPath,
      taskPriority: ['high', 'medium'],
      taskDueAfter: '2024-02-01T00:00:00.000Z',
      taskDueBefore: '2024-03-01T00:00:00.000Z',
    });
    expect(filtered.map((session) => session.sessionId)).toEqual(['sess-window']);
  });

  it('rejects invalid task filters before querying either persistence path', async () => {
    await expect(
      SessionService.listSessions({
        cwd: projectPath,
        taskStatus: 'pending' as 'queued',
      })
    ).rejects.toThrow('Invalid session task status filter');
    await expect(
      SessionService.listSessions({
        cwd: projectPath,
        taskPriority: 'urgent' as 'high',
      })
    ).rejects.toThrow('Invalid session task priority filter');
    await expect(
      SessionService.listSessions({
        cwd: projectPath,
        taskDueBefore: 'not-a-date',
      })
    ).rejects.toThrow('Invalid session taskDueBefore filter');
    await expect(
      SessionService.listSessions({
        cwd: projectPath,
        taskDueAfter: '2024-04-01T00:00:00.000Z',
        taskDueBefore: '2024-03-01T00:00:00.000Z',
      })
    ).rejects.toThrow('Session task due range is inverted');
  });

  it('returns every session when no taskStatus filter is given', async () => {
    await writeSession('sess-queued', 'q', 'a', ts(1), { status: 'queued' });
    await writeSession('sess-done', 'd', 'a', ts(2)); // completed

    const all = await SessionService.listSessions({ cwd: projectPath });
    expect(new Set(all.map((s) => s.sessionId))).toEqual(
      new Set(['sess-queued', 'sess-done'])
    );
  });
});
