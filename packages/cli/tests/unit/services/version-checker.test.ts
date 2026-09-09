import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  proxyFetch: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: mocks.readFile,
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

vi.mock('../../../src/utils/packageInfo.js', () => ({
  getVersion: () => '0.10.24',
}));

vi.mock('../../../src/utils/proxyFetch.js', () => ({
  proxyFetch: <T>(
    url: string,
    options: unknown,
    consume: (response: Response) => Promise<T>
  ) => mocks.proxyFetch(url, options).then(consume),
}));

import {
  checkVersion,
  checkVersionOnStartup,
} from '../../../src/services/VersionChecker.js';

describe('VersionChecker cache freshness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockReset();
    mocks.proxyFetch.mockReset();
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
  });

  it('does not wait for registry access on a cold startup', async () => {
    mocks.readFile.mockRejectedValue(new Error('missing cache'));
    let release!: (response: Response) => void;
    mocks.proxyFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    let settled = false;
    const startup = checkVersionOnStartup().then((result) => {
      settled = true;
      return result;
    });
    try {
      await vi.waitFor(() => expect(mocks.proxyFetch).toHaveBeenCalledOnce());
      expect(settled).toBe(true);
    } finally {
      release(Response.json({ version: '0.10.25' }));
      await startup;
      await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalled());
    }
    expect(await startup).toBeNull();
  });

  it('coalesces simultaneous cold-start refreshes into one registry request', async () => {
    mocks.readFile.mockRejectedValue(new Error('missing cache'));
    let release!: (response: Response) => void;
    mocks.proxyFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    try {
      expect(
        await Promise.all([
          checkVersionOnStartup(),
          checkVersionOnStartup(),
          checkVersionOnStartup(),
        ])
      ).toEqual([null, null, null]);
      await vi.waitFor(() => expect(mocks.proxyFetch).toHaveBeenCalledOnce());
    } finally {
      release(Response.json({ version: '0.10.25' }));
      await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalled());
    }
  });

  it.each([
    { latestVersion: '0.10.25', skipUntilVersion: undefined, shouldPrompt: true },
    { latestVersion: '0.10.25', skipUntilVersion: '0.10.25', shouldPrompt: false },
    { latestVersion: '0.10.26', skipUntilVersion: '0.10.25', shouldPrompt: true },
    { latestVersion: '0.10.24', skipUntilVersion: undefined, shouldPrompt: false },
    { latestVersion: '0.10.8', skipUntilVersion: undefined, shouldPrompt: false },
  ])(
    'uses fresh cache $latestVersion with skip $skipUntilVersion without fetching',
    async (cache) => {
      mocks.readFile.mockResolvedValue(
        JSON.stringify({ ...cache, checkedAt: Date.now() })
      );
      const result = await checkVersionOnStartup();
      if (cache.shouldPrompt) {
        expect(result).toMatchObject({
          currentVersion: '0.10.24',
          latestVersion: cache.latestVersion,
          hasUpdate: true,
          shouldPrompt: true,
        });
      } else {
        expect(result).toBeNull();
      }
      expect(mocks.proxyFetch).not.toHaveBeenCalled();
    }
  );

  it('refreshes an expired cache without showing a stale startup prompt', async () => {
    let cached = JSON.stringify({
      latestVersion: '0.10.25',
      checkedAt: 1,
      skipUntilVersion: '0.10.25',
    });
    mocks.readFile.mockImplementation(async () => cached);
    mocks.writeFile.mockImplementation(async (_file: string, contents: string) => {
      cached = contents;
    });
    mocks.proxyFetch.mockResolvedValue(Response.json({ version: '0.10.26' }));

    expect(await checkVersionOnStartup()).toBeNull();
    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledOnce());
    expect(await checkVersionOnStartup()).toMatchObject({
      latestVersion: '0.10.26',
      shouldPrompt: true,
    });
    expect(JSON.parse(cached).skipUntilVersion).toBe('0.10.25');
  });

  it('releases the startup refresh after failure so a later startup can retry', async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ latestVersion: '0.10.25', checkedAt: 1 })
    );
    mocks.proxyFetch.mockRejectedValueOnce(new Error('offline'));
    expect(await checkVersionOnStartup()).toBeNull();
    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledOnce());
    mocks.proxyFetch.mockResolvedValueOnce(Response.json({ version: '0.10.26' }));
    expect(await checkVersionOnStartup()).toBeNull();
    await vi.waitFor(() => expect(mocks.proxyFetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledTimes(2));
  });

  it('does not overwrite a dismissal saved while the background refresh is pending', async () => {
    let cached = JSON.stringify({
      latestVersion: '0.10.25',
      checkedAt: 1,
      skipUntilVersion: '0.10.24',
    });
    mocks.readFile.mockImplementation(async () => cached);
    mocks.writeFile.mockImplementation(async (_file: string, contents: string) => {
      cached = contents;
    });
    let release!: (response: Response) => void;
    mocks.proxyFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    expect(await checkVersionOnStartup()).toBeNull();
    await vi.waitFor(() => expect(mocks.proxyFetch).toHaveBeenCalledOnce());
    cached = JSON.stringify({
      latestVersion: '0.10.25',
      checkedAt: Date.now(),
      skipUntilVersion: '0.10.26',
    });
    release(Response.json({ version: '0.10.26' }));
    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledOnce());
    expect(JSON.parse(cached).skipUntilVersion).toBe('0.10.26');
  });

  it('explicit checks still wait for the registry even with a fresh cache', async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ latestVersion: '0.10.24', checkedAt: Date.now() })
    );
    let release!: (response: Response) => void;
    mocks.proxyFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    let settled = false;
    const explicit = checkVersion(true).then((result) => {
      settled = true;
      return result;
    });
    await vi.waitFor(() => expect(mocks.proxyFetch).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    release(Response.json({ version: '0.10.26' }));
    expect(await explicit).toMatchObject({
      latestVersion: '0.10.26',
      shouldPrompt: true,
    });
  });

  it.each([{ version: 42 }, { version: 'invalid' }, null, {}])(
    'ignores invalid registry metadata %j without caching it',
    async (metadata) => {
      mocks.readFile.mockRejectedValue(new Error('missing cache'));
      mocks.proxyFetch.mockResolvedValue(Response.json(metadata));
      expect(await checkVersion(true)).toMatchObject({
        latestVersion: null,
        shouldPrompt: false,
      });
      expect(mocks.writeFile).not.toHaveBeenCalled();
    }
  );

  it('never reports a cached latest version older than the installed package', async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({
        latestVersion: '0.10.8',
        checkedAt: Date.now(),
      })
    );

    await expect(checkVersion()).resolves.toMatchObject({
      currentVersion: '0.10.24',
      latestVersion: '0.10.24',
      hasUpdate: false,
      shouldPrompt: false,
    });
    const persisted = JSON.parse(String(mocks.writeFile.mock.calls[0]?.[1]));
    expect(persisted).toMatchObject({
      latestVersion: '0.10.24',
      checkedAt: expect.any(Number),
    });
  });

  it('clears a stale latestVersion when the registry refresh fails', async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({
        latestVersion: '0.10.8',
        checkedAt: 1,
        skipUntilVersion: '0.10.8',
      })
    );
    mocks.proxyFetch.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(checkVersion()).resolves.toMatchObject({
      latestVersion: null,
      hasUpdate: false,
      shouldPrompt: false,
      error: 'Unable to check for updates',
    });
    const persisted = JSON.parse(String(mocks.writeFile.mock.calls[0]?.[1]));
    expect(persisted).toEqual({
      checkedAt: 0,
      skipUntilVersion: '0.10.8',
    });
  });
});
