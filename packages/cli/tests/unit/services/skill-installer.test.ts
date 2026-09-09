import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type GitCallback = (error: Error | null, stdout?: string, stderr?: string) => void;
const mocks = vi.hoisted(() => ({ exec: vi.fn(), execFile: vi.fn() }));
vi.mock('node:child_process', () => mocks);

import { SkillInstaller } from '../../../src/skills/SkillInstaller.js';

const content =
  '---\nname: safe-skill\ndescription: Installer fixture\n---\nSAFE_SKILL\n';

describe('SkillInstaller input and process boundaries', () => {
  let root: string;
  let skills: string;
  let source: string;
  let installer: SkillInstaller;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'blade-skill-installer-'));
    skills = path.join(root, 'skills with spaces');
    source = path.join(root, 'source', 'safe-skill');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'SKILL.md'), content);
    installer = new SkillInstaller(skills);
    mocks.exec
      .mockReset()
      .mockImplementation(
        (_command: string, optionsOrCallback: unknown, callback?: GitCallback) => {
          const done =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
          done?.(new Error('Shell execution is not allowed'));
        }
      );
    mocks.execFile
      .mockReset()
      .mockImplementation(
        (
          _executable: string,
          args: string[],
          _options: unknown,
          callback: GitCallback
        ) => {
          void (async () => {
            if (args.includes('--version')) {
              callback(null, 'git version fixture', '');
              return;
            }
            const destination = args.at(-1);
            if (!args.includes('clone') || !destination)
              throw new Error('Unexpected Git arguments');
            const isOfficial = args.includes(
              'https://github.com/anthropics/skills.git'
            );
            await cp(
              source,
              isOfficial ? path.join(destination, 'skills', 'safe-skill') : destination,
              { recursive: true }
            );
            callback(null, '', '');
          })().catch((error: unknown) =>
            callback(error instanceof Error ? error : new Error(String(error)))
          );
        }
      );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    '../outside',
    '..',
    '.',
    'nested/skill',
    'nested\\skill',
    'bad name',
    '$(marker)',
    '-option',
    'safe\n',
    'a'.repeat(65),
  ])('rejects local install name %j before removing or writing files', async (name) => {
    await mkdir(path.join(root, 'outside'));
    await writeFile(path.join(root, 'outside', 'keep.txt'), 'KEEP');
    expect(await installer.installFromLocal(source, name, false)).toBe(false);
    expect(await readFile(path.join(root, 'outside', 'keep.txt'), 'utf8')).toBe('KEEP');
    expect(await readFile(path.join(source, 'SKILL.md'), 'utf8')).toBe(content);
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.execFile).not.toHaveBeenCalled();
    await expect(readdir(skills)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['../outside', 'bad name', '$(marker)', '-option', 'safe\n'])(
    'rejects catalog and repository name %j before Git',
    async (name) => {
      expect(await installer.installOfficialSkill(name)).toBe(false);
      expect(
        await installer.installFromRepo(
          'https://github.com/example/safe-skill.git',
          name
        )
      ).toBe(false);
      expect(mocks.exec).not.toHaveBeenCalled();
      expect(mocks.execFile).not.toHaveBeenCalled();
    }
  );

  it.each([
    '--upload-pack=marker',
    'ext::marker',
    'file:///tmp/skill',
    'http://example.test/skill.git',
    'https://user:secret@example.test/skill.git',
    'https://token@example.test/skill.git',
    'ssh://git:secret@example.test/skill.git',
    'https://example.test/skill.git?token=secret',
    'https://example.test/skill.git#main',
    'https://example.test/skill.git\n',
  ])('rejects unsafe repository input %j without starting Git', async (url) => {
    expect(await installer.installFromRepo(url, 'safe-skill')).toBe(false);
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.execFile).not.toHaveBeenCalled();
    await expect(readdir(skills)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    'https://github.com/example/safe-skill.git',
    'ssh://git@example.test/team/safe-skill.git',
    'git@example.test:team/safe-skill.git',
  ])('passes repository %s as an argument rather than a shell command', async (url) => {
    expect(await installer.installFromRepo(url)).toBe(true);
    expect(mocks.exec).not.toHaveBeenCalled();
    const clone = mocks.execFile.mock.calls.find((call) => call[1].includes('clone'));
    expect(clone?.[0]).toBe('git');
    expect(clone?.[1].slice(-3)).toEqual(['--', url, expect.any(String)]);
    expect(clone?.[2]).toMatchObject({
      shell: false,
      timeout: 60000,
      env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
    });
    expect(await readFile(path.join(skills, 'safe-skill', 'SKILL.md'), 'utf8')).toBe(
      content
    );
    expect(await readdir(skills)).toEqual(['safe-skill']);
  });

  it.each([true, false])(
    'installs and reinstalls a local path with spaces (symlink=%s)',
    async (linked) => {
      const local = path.join(root, 'source with spaces', 'safe-skill');
      await mkdir(local, { recursive: true });
      await writeFile(path.join(local, 'SKILL.md'), content);
      expect(await installer.installFromLocal(local, undefined, linked)).toBe(true);
      expect(await installer.installFromLocal(local, undefined, linked)).toBe(true);
      expect(await readFile(path.join(skills, 'safe-skill', 'SKILL.md'), 'utf8')).toBe(
        content
      );
      expect(await readFile(path.join(local, 'SKILL.md'), 'utf8')).toBe(content);
      expect(mocks.exec).not.toHaveBeenCalled();
      expect(mocks.execFile).not.toHaveBeenCalled();
    }
  );

  it('preserves the previous installation when the cloned repository has no skill file', async () => {
    const installed = path.join(skills, 'safe-skill');
    await mkdir(installed, { recursive: true });
    await writeFile(path.join(installed, 'SKILL.md'), 'PREVIOUS_SKILL');
    await rm(path.join(source, 'SKILL.md'));
    expect(await installer.installFromRepo('https://example.test/safe-skill.git')).toBe(
      false
    );
    expect(await readFile(path.join(installed, 'SKILL.md'), 'utf8')).toBe(
      'PREVIOUS_SKILL'
    );
    expect(await readdir(skills)).toEqual(['safe-skill']);
  });

  it('uses argument-based cloning for individual and bulk official installs', async () => {
    expect(await installer.installOfficialSkill('safe-skill')).toBe(true);
    expect(await installer.installAllOfficialSkills()).toEqual({
      installed: ['safe-skill'],
      failed: [],
    });
    expect(mocks.exec).not.toHaveBeenCalled();
    for (const call of mocks.execFile.mock.calls.filter((entry) =>
      entry[1].includes('clone')
    )) {
      expect(call[1].slice(-3)).toEqual([
        '--',
        'https://github.com/anthropics/skills.git',
        expect.any(String),
      ]);
      expect(call[2].shell).toBe(false);
    }
  });

  it('rejects copying a source directory into its own descendant before touching the destination', async () => {
    const parent = path.join(root, 'parent-source');
    const nestedSkills = path.join(parent, 'nested-skills');
    await mkdir(parent);
    await writeFile(path.join(parent, 'SKILL.md'), content);
    const nestedInstaller = new SkillInstaller(nestedSkills);
    expect(await nestedInstaller.installFromLocal(parent, 'safe-skill', false)).toBe(
      false
    );
    expect(await readdir(parent)).toEqual(['SKILL.md']);
  });

  it('detects source overlap through a symlinked installation directory', async () => {
    const realSkills = path.join(root, 'real-skills');
    const local = path.join(realSkills, 'safe-skill', 'nested');
    await mkdir(local, { recursive: true });
    await writeFile(path.join(local, 'SKILL.md'), content);
    await symlink(
      realSkills,
      skills,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(await installer.installFromLocal(local, 'safe-skill', false)).toBe(false);
    expect(await readFile(path.join(local, 'SKILL.md'), 'utf8')).toBe(content);
  });

  it('preserves a case-aliased source on case-insensitive filesystems', async (context) => {
    const local = path.join(skills, 'Safe-Skill');
    await mkdir(local, { recursive: true });
    await writeFile(path.join(local, 'SKILL.md'), content);
    const aliasExists = await access(path.join(skills, 'safe-skill')).then(
      () => true,
      () => false
    );
    if (!aliasExists) {
      context.skip();
      return;
    }
    expect(await installer.installFromLocal(local, 'safe-skill', false)).toBe(false);
    expect(await readFile(path.join(local, 'SKILL.md'), 'utf8')).toBe(content);
  });

  it.each(['same', 'nested'] as const)(
    'preserves the local source when it is %s as or inside the replacement target',
    async (location) => {
      const target = path.join(skills, 'safe-skill');
      const local = location === 'same' ? target : path.join(target, 'nested');
      await mkdir(local, { recursive: true });
      await writeFile(path.join(local, 'SKILL.md'), content);
      expect(await installer.installFromLocal(local, 'safe-skill', false)).toBe(false);
      expect(await readFile(path.join(local, 'SKILL.md'), 'utf8')).toBe(content);
    }
  );
});
