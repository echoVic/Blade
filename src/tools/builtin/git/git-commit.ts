import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Commit 工具
 * 提交暂存区的更改
 */
export const gitCommit: ToolDefinition = {
  name: 'git_commit',
  description: '提交Git暂存区的更改',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'commit', 'save', 'record'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    message: {
      type: 'string',
      required: true,
      description: '提交信息',
      default: '',
    },
    all: {
      type: 'boolean',
      required: false,
      description: '自动暂存所有已跟踪文件的更改',
      default: false,
    },
    amend: {
      type: 'boolean',
      required: false,
      description: '修改最后一次提交',
      default: false,
    },
    author: {
      type: 'string',
      required: false,
      description: '指定作者 (格式: "Name <email>")',
      default: '',
    },
    dryRun: {
      type: 'boolean',
      required: false,
      description: '干运行，只显示将要提交的内容',
      default: false,
    },
    allowEmpty: {
      type: 'boolean',
      required: false,
      description: '允许空提交',
      default: false,
    },
  },

  async execute(parameters) {
    const {
      path = '.',
      message,
      all = false,
      amend = false,
      author = '',
      dryRun = false,
      allowEmpty = false,
    } = parameters;

    try {
      // 验证提交信息
      if (!message || message.trim().length === 0) {
        throw new Error('提交信息不能为空');
      }

      // 检查是否有暂存的更改（除非是amend或allowEmpty）
      if (!amend && !allowEmpty && !dryRun) {
        const { stdout: statusOutput } = await execAsync('git status --porcelain', {
          cwd: path,
          timeout: 5000,
        });

        const hasStaged = statusOutput
          .split('\n')
          .some(line => line.trim() && line[0] !== ' ' && line[0] !== '?');

        if (!hasStaged && !all) {
          throw new Error('没有暂存的更改可以提交。请先使用 git add 或启用 all 选项');
        }
      }

      let command = 'git commit';

      // 添加选项
      if (dryRun) {
        command += ' --dry-run';
      }

      if (all) {
        command += ' -a';
      }

      if (amend) {
        command += ' --amend';
      }

      if (allowEmpty) {
        command += ' --allow-empty';
      }

      if (author) {
        // 验证作者格式
        if (!author.includes('<') || !author.includes('>')) {
          throw new Error('作者格式应为 "Name <email>"');
        }
        command += ` --author="${author}"`;
      }

      // 添加提交信息
      command += ` -m "${message.replace(/"/g, '\\"')}"`;

      const { stdout, stderr } = await execAsync(command, {
        cwd: path,
        timeout: 15000,
      });

      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }

      const output = stdout.trim();

      const result: any = {
        path,
        command,
        message,
        rawOutput: output,
      };

      if (dryRun) {
        // 解析干运行结果
        result.wouldCommit = true;
        result.previewMessage = message;
        result.output = output;
      } else {
        // 解析提交结果
        const lines = output.split('\n');

        // 提取提交hash
        let commitHash = '';
        let commitSummary = '';

        for (const line of lines) {
          if (line.includes('[') && line.includes(']')) {
            const match = line.match(/\[([^\]]+)\]\s*(.+)/);
            if (match) {
              commitHash = match[1];
              commitSummary = match[2];
            }
          }
        }

        // 提取文件统计
        let filesChanged = 0;
        let insertions = 0;
        let deletions = 0;

        const statsLine = lines.find(
          line => line.includes('file') && (line.includes('insertion') || line.includes('deletion'))
        );

        if (statsLine) {
          const fileMatch = statsLine.match(/(\d+)\s+file/);
          if (fileMatch) filesChanged = parseInt(fileMatch[1]);

          const insertMatch = statsLine.match(/(\d+)\s+insertion/);
          if (insertMatch) insertions = parseInt(insertMatch[1]);

          const deleteMatch = statsLine.match(/(\d+)\s+deletion/);
          if (deleteMatch) deletions = parseInt(deleteMatch[1]);
        }

        result.success = true;
        result.commitHash = commitHash;
        result.commitSummary = commitSummary;
        result.statistics = {
          filesChanged,
          insertions,
          deletions,
        };

        // 获取最新的提交信息
        try {
          const { stdout: logOutput } = await execAsync(
            'git log -1 --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso',
            { cwd: path, timeout: 5000 }
          );

          const parts = logOutput.split('|');
          if (parts.length >= 5) {
            result.commitDetails = {
              fullHash: parts[0],
              author: parts[1],
              email: parts[2],
              date: parts[3],
              message: parts[4],
            };
          }
        } catch (logError) {
          // 忽略log获取失败
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git commit failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
