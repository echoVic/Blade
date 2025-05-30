import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Branch 工具
 * 管理Git分支
 */
export const gitBranch: ToolDefinition = {
  name: 'git_branch',
  description: '管理Git分支',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'branch', 'checkout', 'switch'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    action: {
      type: 'string',
      required: false,
      description: '操作类型: list(列出), create(创建), delete(删除), switch(切换)',
      default: 'list',
    },
    branchName: {
      type: 'string',
      required: false,
      description: '分支名称',
      default: '',
    },
    remote: {
      type: 'boolean',
      required: false,
      description: '包含远程分支',
      default: false,
    },
    all: {
      type: 'boolean',
      required: false,
      description: '显示所有分支（本地和远程）',
      default: false,
    },
    createFrom: {
      type: 'string',
      required: false,
      description: '从指定分支创建新分支',
      default: '',
    },
  },

  async execute(parameters) {
    const {
      path = '.',
      action = 'list',
      branchName = '',
      remote = false,
      all = false,
      createFrom = '',
    } = parameters;

    try {
      let command = '';

      switch (action.toLowerCase()) {
        case 'list':
          command = 'git branch';
          if (all) {
            command += ' -a';
          } else if (remote) {
            command += ' -r';
          }
          break;

        case 'create':
          if (!branchName) {
            throw new Error('创建分支需要指定分支名称');
          }
          command = `git branch ${branchName}`;
          if (createFrom) {
            command += ` ${createFrom}`;
          }
          break;

        case 'delete':
          if (!branchName) {
            throw new Error('删除分支需要指定分支名称');
          }
          command = `git branch -d ${branchName}`;
          break;

        case 'switch':
        case 'checkout':
          if (!branchName) {
            throw new Error('切换分支需要指定分支名称');
          }
          command = `git checkout ${branchName}`;
          break;

        default:
          throw new Error(`不支持的操作: ${action}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: path,
        timeout: 10000,
      });

      if (stderr && !stderr.includes('warning') && !stderr.includes('Switched to')) {
        throw new Error(stderr);
      }

      const output = stdout.trim();

      const result: any = {
        path,
        command,
        action,
        rawOutput: output,
      };

      if (action === 'list') {
        // 解析分支列表
        const lines = output.split('\n').filter(line => line.trim());
        const branches = lines.map(line => {
          const trimmed = line.trim();
          const isCurrent = trimmed.startsWith('*');
          const isRemote = trimmed.includes('remotes/');

          let name = trimmed.replace(/^\*?\s*/, '');
          if (isRemote) {
            name = name.replace('remotes/', '');
          }

          return {
            name,
            isCurrent,
            isRemote,
            fullName: trimmed.replace(/^\*?\s*/, ''),
          };
        });

        result.branches = branches;
        result.currentBranch = branches.find(b => b.isCurrent)?.name || '';
        result.totalBranches = branches.length;
        result.localBranches = branches.filter(b => !b.isRemote).length;
        result.remoteBranches = branches.filter(b => b.isRemote).length;
      } else {
        // 其他操作的结果
        result.success = true;
        result.message = output || stderr;

        if (action === 'create') {
          result.createdBranch = branchName;
        } else if (action === 'delete') {
          result.deletedBranch = branchName;
        } else if (action === 'switch' || action === 'checkout') {
          result.switchedTo = branchName;
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git branch operation failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
