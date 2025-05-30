import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Log 工具
 * 查看Git提交历史
 */
export const gitLog: ToolDefinition = {
  name: 'git_log',
  description: '查看Git提交历史',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'log', 'history', 'commits'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    limit: {
      type: 'number',
      required: false,
      description: '显示的提交数量限制',
      default: 10,
    },
    oneline: {
      type: 'boolean',
      required: false,
      description: '每个提交显示一行',
      default: false,
    },
    graph: {
      type: 'boolean',
      required: false,
      description: '显示分支图形',
      default: false,
    },
    author: {
      type: 'string',
      required: false,
      description: '按作者过滤提交',
      default: '',
    },
    since: {
      type: 'string',
      required: false,
      description: '显示指定日期之后的提交 (如: "2023-01-01", "1 week ago")',
      default: '',
    },
    until: {
      type: 'string',
      required: false,
      description: '显示指定日期之前的提交',
      default: '',
    },
  },

  async execute(parameters) {
    const {
      path = '.',
      limit = 10,
      oneline = false,
      graph = false,
      author = '',
      since = '',
      until = '',
    } = parameters;

    try {
      let command = 'git log';

      // 添加限制
      if (limit > 0) {
        command += ` -${limit}`;
      }

      // 添加格式选项
      if (oneline) {
        command += ' --oneline';
      } else {
        command += ' --pretty=format:"%h|%an|%ae|%ad|%s" --date=iso';
      }

      // 添加图形显示
      if (graph) {
        command += ' --graph';
      }

      // 添加作者过滤
      if (author) {
        command += ` --author="${author}"`;
      }

      // 添加日期过滤
      if (since) {
        command += ` --since="${since}"`;
      }

      if (until) {
        command += ` --until="${until}"`;
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
        const lines = output.split('\n');

        if (oneline) {
          // 解析 oneline 格式
          result.commits = lines.map(line => {
            const spaceIndex = line.indexOf(' ');
            return {
              hash: line.substring(0, spaceIndex),
              message: line.substring(spaceIndex + 1),
            };
          });
        } else if (!graph) {
          // 解析自定义格式 (不带graph)
          result.commits = lines.map(line => {
            const parts = line.split('|');
            return {
              hash: parts[0],
              author: parts[1],
              email: parts[2],
              date: parts[3],
              message: parts[4],
            };
          });
        } else {
          // 带graph的格式保持原样
          result.output = output;
        }

        result.totalCommits = lines.length;
      } else {
        result.commits = [];
        result.totalCommits = 0;
        result.message = '没有找到提交记录';
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git log failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
