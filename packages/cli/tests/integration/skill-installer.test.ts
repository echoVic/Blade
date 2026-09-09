import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillInstaller } from '../../src/skills/SkillInstaller.js';

vi.unmock('node:child_process');

const execFileAsync = promisify(execFile);
const content =
  '---\nname: safe-skill\ndescription: Real Git fixture\n---\nREAL_GIT_SKILL\n';
let root: string;
let repo: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'blade-skill-git-'));
  repo = path.join(root, 'source');
  await mkdir(repo);
  await execFileAsync('git', ['init', repo], { timeout: 10000 });
  await writeFile(path.join(repo, 'SKILL.md'), content);
  const { stdout: blob } = await execFileAsync('git', [
    '-C',
    repo,
    'hash-object',
    '-w',
    '--',
    'SKILL.md',
  ]);
  await execFileAsync('git', [
    '-C',
    repo,
    'update-index',
    '--add',
    '--cacheinfo',
    `100644,${blob.trim()},SKILL.md`,
  ]);
  const { stdout: tree } = await execFileAsync('git', ['-C', repo, 'write-tree']);
  const { stdout: commit } = await execFileAsync(
    'git',
    ['-C', repo, 'commit-tree', tree.trim(), '-m', 'Fixture'],
    {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@testmail.com',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@testmail.com',
      },
    }
  );
  await execFileAsync('git', ['-C', repo, 'update-ref', 'HEAD', commit.trim()]);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe('SkillInstaller real Git process', () => {
  it('preserves literal shell metacharacters in repository and destination arguments', async () => {
    const marker = path.join(root, 'shell-expanded');
    const url = `https://example.test/$(touch${'${IFS}'}${marker})/safe-skill.git`;
    const slot = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
    vi.stubEnv(`GIT_CONFIG_KEY_${slot}`, `url.${pathToFileURL(repo).href}.insteadOf`);
    vi.stubEnv(`GIT_CONFIG_VALUE_${slot}`, url);
    vi.stubEnv('GIT_CONFIG_COUNT', String(slot + 1));
    const skills = path.join(root, 'skills $HOME; literal');
    const installer = new SkillInstaller(skills);

    expect(await installer.installFromRepo(url)).toBe(true);
    expect(await readFile(path.join(skills, 'safe-skill', 'SKILL.md'), 'utf8')).toBe(
      content
    );
    expect(await readdir(skills)).toEqual(['safe-skill']);
    await expect(access(path.join(skills, 'safe-skill', '.git'))).rejects.toMatchObject(
      { code: 'ENOENT' }
    );
    await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects command and path inputs without changing existing data', async () => {
    const marker = path.join(root, 'unexpected-command');
    const installer = new SkillInstaller(path.join(root, 'skills'));
    expect(await installer.installFromRepo(`ext::touch ${marker}`, 'safe-skill')).toBe(
      false
    );
    expect(await installer.installFromLocal(repo, '../source', false)).toBe(false);
    expect(await readFile(path.join(repo, 'SKILL.md'), 'utf8')).toBe(content);
    await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(path.join(root, 'skills'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
