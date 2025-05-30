import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../../types.js';

const execAsync = promisify(exec);

/**
 * Git Add 工具
 * 添加文件到暂存区
 */
export const gitAdd: ToolDefinition = {
  name: 'git_add',
  description: '添加文件到Git暂存区',
  category: 'git',
  version: '1.0.0',
  author: 'Agent CLI',
  tags: ['git', 'add', 'stage', 'index'],

  parameters: {
    path: {
      type: 'string',
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    files: {
      type: 'string',
      required: false,
      description: '要添加的文件路径，支持通配符，用空格分隔多个文件',
      default: '',
    },
    all: {
      type: 'boolean',
      required: false,
      description: '添加所有修改的文件',
      default: false,
    },
    update: {
      type: 'boolean',
      required: false,
      description: '只添加已跟踪的文件',
      default: false,
    },
    interactive: {
      type: 'boolean',
      required: false,
      description: '交互式添加（实际执行时会跳过）',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      required: false,
      description: '干运行，只显示将要添加的文件',
      default: false,
    },
  },

  async execute(parameters) {
    const {
      path = '.',
      files = '',
      all = false,
      update = false,
      interactive = false,
      dryRun = false,
    } = parameters;

    try {
      let command = 'git add';

      // 添加选项
      if (dryRun) {
        command += ' --dry-run';
      }

      if (interactive) {
        // 交互式模式在自动化环境中不适用，改为显示提示
        return {
          success: false,
          error: '交互式模式在自动化环境中不支持，请使用其他选项',
          data: null,
        };
      }

      if (all) {
        command += ' -A';
      } else if (update) {
        command += ' -u';
      } else if (files) {
        // 分割文件路径并验证
        const fileList = files.split(/\s+/).filter((f: string) => f.trim());
        if (fileList.length === 0) {
          throw new Error('没有指定有效的文件路径');
        }

        // 验证文件路径安全性
        for (const file of fileList) {
          if (file.includes('..') || file.startsWith('/')) {
            throw new Error(`不安全的文件路径: ${file}`);
          }
        }

        command += ` ${fileList.join(' ')}`;
      } else {
        // 默认添加当前目录下所有文件
        command += ' .';
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

      if (dryRun) {
        // 解析干运行结果
        const lines = output.split('\n').filter(line => line.trim());
        result.wouldAdd = lines.map(line => line.replace(/^add\s+/, ''));
        result.fileCount = result.wouldAdd.length;
        result.message = `将要添加 ${result.fileCount} 个文件到暂存区`;
      } else {
        // 实际添加操作
        result.success = true;

        // 获取当前暂存区状态
        try {
          const { stdout: statusOutput } = await execAsync('git status --porcelain', {
            cwd: path,
            timeout: 5000,
          });

          const statusLines = statusOutput.split('\n').filter(line => line.trim());
          const stagedFiles = statusLines
            .filter(line => line[0] !== ' ' && line[0] !== '?')
            .map(line => line.substring(3));

          result.stagedFiles = stagedFiles;
          result.stagedCount = stagedFiles.length;
          result.message = output || `成功添加文件到暂存区`;
        } catch (statusError) {
          result.message = output || '文件已添加到暂存区';
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Git add failed: ${(error as Error).message}`,
        data: null,
      };
    }
  },
};
