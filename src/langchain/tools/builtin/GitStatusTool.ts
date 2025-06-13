import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import {
  RiskLevel,
  ToolCategory,
  type BladeToolConfig,
  type BladeToolResult,
  type ToolExecutionContext,
} from '../types.js';

const execAsync = promisify(exec);

/**
 * Git 状态工具
 * 查看Git仓库的当前状态，包括暂存、修改和未跟踪文件
 */
export class GitStatusTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'git_status',
      description: '查看Git仓库的当前状态，显示文件修改、暂存和未跟踪信息',
      category: ToolCategory.GIT,
      tags: ['git', 'status', 'repository', 'changes', 'staging'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().default('.'),
      format: z.enum(['standard', 'porcelain', 'short']).default('standard'),
      showBranch: z.boolean().default(true),
      showRemote: z.boolean().default(true),
      showStash: z.boolean().default(false),
    });
  }

  protected async executeInternal(
    params: {
      path?: string;
      format?: string;
      showBranch?: boolean;
      showRemote?: boolean;
      showStash?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      path = '.',
      format = 'standard',
      showBranch = true,
      showRemote = true,
      showStash = false,
    } = params;
    const startTime = Date.now();

    try {
      // 检查是否在Git仓库中
      await this.checkGitRepository(path);

      // 构建Git status命令
      let command = 'git status';
      if (format === 'porcelain') {
        command += ' --porcelain=v1';
      } else if (format === 'short') {
        command += ' --short';
      }

      // 执行Git status命令
      const statusResult = await execAsync(command, { cwd: path });
      const statusOutput = statusResult.stdout.trim();

      // 获取额外信息
      const branchInfo = showBranch ? await this.getBranchInfo(path) : null;
      const remoteInfo = showRemote ? await this.getRemoteInfo(path) : null;
      const stashInfo = showStash ? await this.getStashInfo(path) : null;

      // 解析状态信息
      const parsedStatus = this.parseGitStatus(statusOutput, format);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          format,
          repository: {
            path,
            ...branchInfo,
            ...remoteInfo,
            ...stashInfo,
          },
          status: parsedStatus,
          summary: this.generateSummary(parsedStatus),
          rawOutput: statusOutput,
        },
        duration: executionTime,
        metadata: {
          operation: 'git_status',
          executionTime,
          executionId: context.executionId,
          gitConfig: {
            format,
            showBranch,
            showRemote,
            showStash,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `Git状态查询失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'git_status',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          gitConfig: {
            path,
            format,
          },
        },
      };
    }
  }

  /**
   * 检查是否在Git仓库中
   */
  private async checkGitRepository(path: string): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: path });
    } catch (error) {
      throw new Error('当前目录不是Git仓库，请先运行 git init 初始化仓库');
    }
  }

  /**
   * 获取分支信息
   */
  private async getBranchInfo(path: string): Promise<any> {
    try {
      const [currentBranch, branches] = await Promise.all([
        execAsync('git branch --show-current', { cwd: path }),
        execAsync('git branch -a', { cwd: path }),
      ]);

      const branchLines = branches.stdout.trim().split('\n');
      const localBranches = branchLines
        .filter(line => !line.includes('remotes/'))
        .map(line => line.replace(/^\*\s*/, '').trim());

      const remoteBranches = branchLines
        .filter(line => line.includes('remotes/'))
        .map(line => line.trim().replace('remotes/', ''));

      return {
        currentBranch: currentBranch.stdout.trim(),
        localBranches,
        remoteBranches,
        totalBranches: localBranches.length + remoteBranches.length,
      };
    } catch (error) {
      return {
        currentBranch: 'unknown',
        localBranches: [],
        remoteBranches: [],
        totalBranches: 0,
      };
    }
  }

  /**
   * 获取远程仓库信息
   */
  private async getRemoteInfo(path: string): Promise<any> {
    try {
      const remotes = await execAsync('git remote -v', { cwd: path });
      const remoteLines = remotes.stdout.trim().split('\n');

      const remoteMap: Record<string, { fetch?: string; push?: string }> = {};

      remoteLines.forEach(line => {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (match) {
          const [, name, url, type] = match;
          if (!remoteMap[name]) remoteMap[name] = {};
          remoteMap[name][type as 'fetch' | 'push'] = url;
        }
      });

      return {
        remotes: remoteMap,
        remoteCount: Object.keys(remoteMap).length,
      };
    } catch (error) {
      return {
        remotes: {},
        remoteCount: 0,
      };
    }
  }

  /**
   * 获取stash信息
   */
  private async getStashInfo(path: string): Promise<any> {
    try {
      const stash = await execAsync('git stash list', { cwd: path });
      const stashLines = stash.stdout
        .trim()
        .split('\n')
        .filter(line => line.trim());

      return {
        stashes: stashLines,
        stashCount: stashLines.length,
      };
    } catch (error) {
      return {
        stashes: [],
        stashCount: 0,
      };
    }
  }

  /**
   * 解析Git状态输出
   */
  private parseGitStatus(output: string, format: string): any {
    if (!output) {
      return {
        clean: true,
        files: [],
      };
    }

    const lines = output.split('\n').filter(line => line.trim());

    if (format === 'porcelain' || format === 'short') {
      const files = lines.map(line => {
        const status = line.substring(0, 2);
        const filename = line.substring(3);

        return {
          filename,
          status,
          staged: status[0] !== ' ' && status[0] !== '?',
          modified: status[1] !== ' ' && status[1] !== '?',
          untracked: status === '??',
          deleted: status.includes('D'),
          renamed: status.includes('R'),
          copied: status.includes('C'),
          typeChanged: status.includes('T'),
        };
      });

      return {
        clean: files.length === 0,
        files,
      };
    } else {
      // 标准格式解析
      const isClean = output.includes('nothing to commit, working tree clean');

      return {
        clean: isClean,
        hasChangesToCommit: output.includes('Changes to be committed'),
        hasUnstagedChanges: output.includes('Changes not staged for commit'),
        hasUntrackedFiles: output.includes('Untracked files'),
        output,
      };
    }
  }

  /**
   * 生成状态摘要
   */
  private generateSummary(status: any): any {
    if (status.clean) {
      return {
        status: 'clean',
        message: '工作目录干净，没有待提交的更改',
        fileCount: 0,
      };
    }

    if (status.files) {
      const files = status.files;
      return {
        status: 'dirty',
        message: `发现 ${files.length} 个文件有更改`,
        fileCount: files.length,
        breakdown: {
          staged: files.filter((f: any) => f.staged).length,
          modified: files.filter((f: any) => f.modified).length,
          untracked: files.filter((f: any) => f.untracked).length,
          deleted: files.filter((f: any) => f.deleted).length,
        },
      };
    }

    return {
      status: 'unknown',
      message: '无法解析Git状态',
      fileCount: 0,
    };
  }
}
