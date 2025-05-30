import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Diff 工具
 * 查看文件差异
 */
export const gitDiff: ToolDefinition = {
  name: 'git_diff',
  description: '查看Git文件差异',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'diff', 'changes', 'comparison'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    file: {
      type: 'string',
      required: false,
      description: '指定文件路径',
      default: '',
    },
    staged: {
      type: 'boolean',
      required: false,
      description: '查看暂存区的差异',
      default: false,
    },
    cached: {
      type: 'boolean',
      required: false,
      description: '查看已暂存文件的差异（同staged）',
      default: false,
    },
    nameOnly: {
      type: 'boolean',
      required: false,
      description: '只显示文件名',
      default: false,
    },
    stat: {
      type: 'boolean',
      required: false,
      description: '显示统计信息',
      default: false,
    },
    commit1: {
      type: 'string',
      required: false,
      description: '第一个提交hash/分支名',
      default: '',
    },
    commit2: {
      type: 'string',
      required: false,
      description: '第二个提交hash/分支名',
      default: '',
    },
  },

  async execute(parameters) {
    const {
      path = '.',
      file = '',
      staged = false,
      cached = false,
      nameOnly = false,
      stat = false,
      commit1 = '',
      commit2 = '',
    } = parameters;

    try {
      let command = 'git diff';

      // 添加差异类型选项
      if (staged || cached) {
        command += ' --staged';
      }

      // 添加输出格式选项
      if (nameOnly) {
        command += ' --name-only';
      } else if (stat) {
        command += ' --stat';
      }

      // 添加提交比较
      if (commit1 && commit2) {
        command += ` ${commit1}..${commit2}`;
      } else if (commit1) {
        command += ` ${commit1}`;
      }

      // 添加文件路径
      if (file) {
        command += ` -- ${file}`;
      }

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
        rawOutput: output,
      };

      if (output) {
        if (nameOnly) {
          // 解析文件名列表
          result.files = output.split('\n').filter(line => line.trim());
          result.fileCount = result.files.length;
        } else if (stat) {
          // 解析统计信息
          const lines = output.split('\n');
          const files = [];
          let insertions = 0;
          let deletions = 0;

          for (const line of lines) {
            if (line.includes('|')) {
              const parts = line.trim().split('|');
              if (parts.length >= 2) {
                const filename = parts[0].trim();
                const changes = parts[1].trim();
                files.push({ filename, changes });
              }
            } else if (line.includes('insertion') || line.includes('deletion')) {
              const matches = line.match(/(\d+) insertion/);
              if (matches) insertions = parseInt(matches[1]);
              const delMatches = line.match(/(\d+) deletion/);
              if (delMatches) deletions = parseInt(delMatches[1]);
            }
          }

          result.files = files;
          result.summary = {
            fileCount: files.length,
            insertions,
            deletions,
            totalChanges: insertions + deletions,
          };
        } else {
          // 标准diff格式
          result.diff = output;

          // 简单统计
          const lines = output.split('\n');
          const addedLines = lines.filter(line => line.startsWith('+')).length;
          const deletedLines = lines.filter(line => line.startsWith('-')).length;
          const modifiedFiles = new Set();

          lines.forEach(line => {
            if (line.startsWith('diff --git')) {
              const match = line.match(/diff --git a\/(.+) b\/(.+)/);
              if (match) {
                modifiedFiles.add(match[1]);
              }
            }
          });

          result.summary = {
            modifiedFiles: Array.from(modifiedFiles),
            fileCount: modifiedFiles.size,
            addedLines,
            deletedLines,
          };
        }
      } else {
        result.message = '没有发现差异';
        result.hasChanges = false;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git diff failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
