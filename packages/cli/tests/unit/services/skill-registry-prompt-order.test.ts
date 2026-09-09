import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTrustService } from '../../../src/security/WorkspaceTrustService.js';
import { getSkillCreatorContent } from '../../../src/skills/builtin/skill-creator.js';
import { getUpdateConfigContent } from '../../../src/skills/builtin/update-config.js';
import { SkillInstaller } from '../../../src/skills/SkillInstaller.js';
import { SkillRegistry } from '../../../src/skills/SkillRegistry.js';

describe('SkillRegistry offline initialization', () => {
  let root: string;
  let registry: SkillRegistry;
  let install: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'blade-skill-init-'));
    vi.stubEnv('BLADE_STORAGE_ROOT', path.join(root, 'storage'));
    WorkspaceTrustService.resetInstance();
    install = vi
      .spyOn(SkillInstaller.prototype, 'installOfficialSkill')
      .mockResolvedValue(false);
    registry = new SkillRegistry({
      cwd: root,
      userSkillsDir: path.join(root, 'user-skills'),
      claudeUserSkillsDir: path.join(root, 'claude-skills'),
      projectSkillsDir: '.blade/skills',
      claudeProjectSkillsDir: '.claude/skills',
    });
  });

  afterEach(async () => {
    install.mockRestore();
    WorkspaceTrustService.resetInstance();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('loads bundled skills without starting an installer or writing a user skills directory', async () => {
    const result = await registry.initialize();
    expect(result.errors).toEqual([]);
    expect(result.skills.map((skill) => skill.name).sort()).toEqual([
      'skill-creator',
      'update-config',
    ]);
    expect(await registry.loadContent('skill-creator')).toEqual(
      getSkillCreatorContent()
    );
    expect(await registry.loadContent('update-config')).toEqual(
      getUpdateConfigContent()
    );
    expect(install).not.toHaveBeenCalled();
    await expect(access(path.join(root, 'user-skills'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('discovers an explicitly linked local skill and preserves its source on removal', async () => {
    const source = path.join(root, 'source', 'skill-creator');
    const content =
      '---\nname: skill-creator\ndescription: Linked local skill\n---\nLINKED_SKILL_CONTENT\n';
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'SKILL.md'), content);
    const installer = new SkillInstaller(path.join(root, 'user-skills'));
    expect(await installer.installFromLocal(source)).toBe(true);
    await registry.initialize();
    expect(registry.get('skill-creator')).toMatchObject({
      source: 'user',
      basePath: path.join(root, 'user-skills', 'skill-creator'),
    });
    expect((await registry.loadContent('skill-creator'))?.instructions).toBe(
      'LINKED_SKILL_CONTENT'
    );
    await rm(path.join(root, 'user-skills', 'skill-creator'), { recursive: true });
    await registry.refresh();
    expect(await registry.loadContent('skill-creator')).toEqual(
      getSkillCreatorContent()
    );
    expect(await readFile(path.join(source, 'SKILL.md'), 'utf8')).toBe(content);
    expect(install).not.toHaveBeenCalled();
  });

  it('ignores broken skill links without hiding bundled skills', async () => {
    await mkdir(path.join(root, 'user-skills'));
    await symlink(
      path.join(root, 'missing'),
      path.join(root, 'user-skills', 'missing'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const result = await registry.initialize();
    expect(result.errors).toEqual([]);
    expect(registry.has('missing')).toBe(false);
    expect(await registry.loadContent('skill-creator')).toEqual(
      getSkillCreatorContent()
    );
  });

  it('preserves a local override and falls back to bundled content after its explicit removal', async () => {
    const directory = path.join(root, 'user-skills', 'skill-creator');
    const file = path.join(directory, 'SKILL.md');
    const content =
      '---\nname: skill-creator\ndescription: Local override\nuser-invocable: true\n---\nLOCAL_SKILL_OVERRIDE\n';
    await mkdir(directory, { recursive: true });
    await writeFile(file, content);
    await registry.initialize();
    expect(registry.get('skill-creator')?.source).toBe('user');
    expect((await registry.loadContent('skill-creator'))?.instructions).toContain(
      'LOCAL_SKILL_OVERRIDE'
    );
    expect(await readFile(file, 'utf8')).toBe(content);
    await rm(directory, { recursive: true });
    await registry.refresh();
    expect(await registry.loadContent('skill-creator')).toEqual(
      getSkillCreatorContent()
    );
    expect(install).not.toHaveBeenCalled();
    await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('SkillRegistry prompt metadata', () => {
  it('renders model-invocable skills in a cache-stable order', () => {
    const registry = new SkillRegistry({ cwd: '/workspace' });
    registry.registerPluginSkill({
      originalName: 'zeta',
      namespacedName: 'plugin:zeta',
      pluginName: 'plugin',
      path: '/workspace/plugin/zeta',
      metadata: {
        name: 'plugin:zeta',
        description: 'Zeta capability',
        path: '/workspace/plugin/zeta/SKILL.md',
        basePath: '/workspace/plugin/zeta',
        source: 'project',
      },
    });
    registry.registerPluginSkill({
      originalName: 'alpha',
      namespacedName: 'plugin:alpha',
      pluginName: 'plugin',
      path: '/workspace/plugin/alpha',
      metadata: {
        name: 'plugin:alpha',
        description: 'Alpha capability',
        path: '/workspace/plugin/alpha/SKILL.md',
        basePath: '/workspace/plugin/alpha',
        source: 'project',
      },
    });

    expect(registry.generateAvailableSkillsList()).toBe(
      '- plugin:alpha: Alpha capability\n- plugin:zeta: Zeta capability'
    );
  });
});
