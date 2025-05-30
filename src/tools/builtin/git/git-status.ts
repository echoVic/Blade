import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Status 工具
 * 查看Git仓库的当前状态
 */
export const gitStatus: ToolDefinition = {
  name: 'git_status',
  description: '查看Git仓库的当前状态',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'status', 'repository'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    porcelain: {
      type: 'boolean',
      required: false,
      description: '使用机器可读的格式',
      default: false,
    },
    short: {
      type: 'boolean',
      required: false,
      description: '显示简短格式',
      default: false,
    },
  },

  async execute(parameters) {
    const { path = '.', porcelain = false, short = false } = parameters;

    try {
      let command = 'git status';

      if (porcelain) {
        command += ' --porcelain';
      } else if (short) {
        command += ' --short';
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: path,
        timeout: 10000,
      });

      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }

      // 解析状态信息
      const output = stdout.trim();
      const lines = output.split('\n').filter(line => line.trim());

      const result: any = {
        path,
        command: command,
        rawOutput: output,
      };

      if (porcelain || short) {
        // 解析简短格式
        const files = lines.map(line => {
          const status = line.substring(0, 2);
          const filename = line.substring(3);
          return {
            status,
            filename,
            staged: status[0] !== ' ' && status[0] !== '?',
            modified: status[1] !== ' ',
            untracked: status === '??',
          };
        });

        result.files = files;
        result.summary = {
          total: files.length,
          staged: files.filter(f => f.staged).length,
          modified: files.filter(f => f.modified).length,
          untracked: files.filter(f => f.untracked).length,
        };
      } else {
        // 标准格式输出
        result.output = output;

        // 简单解析状态信息
        const hasChanges =
          output.includes('Changes to be committed') ||
          output.includes('Changes not staged') ||
          output.includes('Untracked files');

        result.hasChanges = hasChanges;
        result.isClean = output.includes('nothing to commit, working tree clean');
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git status failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
