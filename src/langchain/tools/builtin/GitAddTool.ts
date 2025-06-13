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
 * Git Add 工具
 * 添加文件到Git暂存区，提供智能文件选择和预览功能
 */
export class GitAddTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'git_add',
      description: '添加文件到Git暂存区，支持智能文件选择和预览',
      category: ToolCategory.GIT,
      tags: ['git', 'add', 'stage', 'index', 'commit'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      files: z.union([z.string(), z.array(z.string())]).optional(),
      all: z.boolean().default(false),
      update: z.boolean().default(false),
      patch: z.boolean().default(false),
      dryRun: z.boolean().default(false),
      interactive: z.boolean().default(false),
      workingDirectory: z.string().default('.'),
      includeIgnored: z.boolean().default(false),
      force: z.boolean().default(false),
    });
  }

  protected async executeInternal(
    params: {
      files?: string | string[];
      all?: boolean;
      update?: boolean;
      patch?: boolean;
      dryRun?: boolean;
      interactive?: boolean;
      workingDirectory?: string;
      includeIgnored?: boolean;
      force?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      files,
      all = false,
      update = false,
      patch = false,
      dryRun = false,
      interactive = false,
      workingDirectory = '.',
      includeIgnored = false,
      force = false,
    } = params;
    const startTime = Date.now();

    try {
      // 检查是否为Git仓库
      await this.validateGitRepository(workingDirectory);

      // 获取仓库状态
      const status = await this.getGitStatus(workingDirectory);

      // 构建文件列表
      const filesToAdd = await this.buildFileList(files, all, update, status, workingDirectory);

      if (filesToAdd.length === 0) {
        return {
          success: false,
          error: '没有找到需要添加的文件',
          duration: Date.now() - startTime,
          metadata: {
            operation: 'git_add',
            executionTime: Date.now() - startTime,
            executionId: context.executionId,
            workingDirectory,
            gitStatus: status.summary,
          },
        };
      }

      // 构建Git命令
      const command = this.buildGitAddCommand(filesToAdd, {
        patch,
        dryRun,
        interactive,
        includeIgnored,
        force,
      });

      // 执行命令
      const result = await execAsync(command, { cwd: workingDirectory });

      // 获取执行后的状态
      const newStatus = dryRun ? status : await this.getGitStatus(workingDirectory);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          command,
          output: result.stdout,
          errors: result.stderr,
          filesAdded: filesToAdd,
          statusBefore: status.summary,
          statusAfter: newStatus.summary,
          addedCount: filesToAdd.length,
          isDryRun: dryRun,
          changes: this.analyzeChanges(status, newStatus),
        },
        duration: executionTime,
        metadata: {
          operation: 'git_add',
          executionTime,
          executionId: context.executionId,
          commandOptions: {
            all,
            update,
            patch,
            dryRun,
            interactive,
            includeIgnored,
            force,
          },
          workingDirectory,
          gitInfo: {
            branch: await this.getCurrentBranch(workingDirectory),
            hasChanges: status.summary.total > 0,
            repository: await this.getRepositoryInfo(workingDirectory),
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `Git add失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'git_add',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          workingDirectory,
          commandAttempted: this.buildGitAddCommand([], params),
        },
      };
    }
  }

  /**
   * 验证Git仓库
   */
  private async validateGitRepository(workingDirectory: string): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: workingDirectory });
    } catch (error) {
      throw new Error('当前目录不是Git仓库');
    }
  }

  /**
   * 获取Git状态
   */
  private async getGitStatus(workingDirectory: string): Promise<any> {
    const { stdout } = await execAsync('git status --porcelain', { cwd: workingDirectory });
    const lines = stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0);

    const files = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      renamed: [] as string[],
      copied: [] as string[],
      untracked: [] as string[],
      ignored: [] as string[],
    };

    for (const line of lines) {
      const status = line.substring(0, 2);
      const fileName = line.substring(3);

      switch (status[1]) {
        case 'M':
          files.modified.push(fileName);
          break;
        case 'A':
          files.added.push(fileName);
          break;
        case 'D':
          files.deleted.push(fileName);
          break;
        case 'R':
          files.renamed.push(fileName);
          break;
        case 'C':
          files.copied.push(fileName);
          break;
        case '?':
          files.untracked.push(fileName);
          break;
        case '!':
          files.ignored.push(fileName);
          break;
      }
    }

    const total = Object.values(files).reduce((sum, arr) => sum + arr.length, 0);

    return {
      files,
      summary: {
        total,
        modified: files.modified.length,
        added: files.added.length,
        deleted: files.deleted.length,
        untracked: files.untracked.length,
      },
      raw: stdout,
    };
  }

  /**
   * 构建文件列表
   */
  private async buildFileList(
    files: string | string[] | undefined,
    all: boolean,
    update: boolean,
    status: any,
    workingDirectory: string
  ): Promise<string[]> {
    if (all) {
      // 添加所有文件
      return [...status.files.modified, ...status.files.deleted, ...status.files.untracked];
    }

    if (update) {
      // 只添加已跟踪的文件
      return [...status.files.modified, ...status.files.deleted];
    }

    if (files) {
      // 添加指定文件
      const fileList = Array.isArray(files) ? files : [files];
      const validFiles: string[] = [];

      for (const file of fileList) {
        try {
          // 验证文件是否存在或在Git状态中
          const { stdout } = await execAsync(`git ls-files --error-unmatch "${file}"`, {
            cwd: workingDirectory,
          }).catch(() => ({ stdout: '' }));

          if (stdout.trim() || status.files.untracked.includes(file)) {
            validFiles.push(file);
          }
        } catch (error) {
          // 忽略不存在的文件
        }
      }

      return validFiles;
    }

    // 默认返回所有修改的文件
    return [...status.files.modified, ...status.files.untracked];
  }

  /**
   * 构建Git add命令
   */
  private buildGitAddCommand(files: string[], options: any): string {
    let command = 'git add';

    if (options.dryRun) {
      command += ' --dry-run';
    }

    if (options.patch) {
      command += ' --patch';
    }

    if (options.interactive) {
      command += ' --interactive';
    }

    if (options.force) {
      command += ' --force';
    }

    if (options.includeIgnored) {
      command += ' --force';
    }

    // 添加文件
    if (files.length > 0) {
      const quotedFiles = files.map(file => `"${file}"`).join(' ');
      command += ` ${quotedFiles}`;
    }

    return command;
  }

  /**
   * 获取当前分支
   */
  private async getCurrentBranch(workingDirectory: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: workingDirectory,
      });
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取仓库信息
   */
  private async getRepositoryInfo(workingDirectory: string): Promise<any> {
    try {
      const [remoteResult, commitResult] = await Promise.all([
        execAsync('git remote -v', { cwd: workingDirectory }).catch(() => ({ stdout: '' })),
        execAsync('git rev-parse HEAD', { cwd: workingDirectory }).catch(() => ({ stdout: '' })),
      ]);

      const remotes = remoteResult.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, url, type] = line.split(/\s+/);
          return { name, url, type: type?.replace(/[()]/g, '') };
        });

      return {
        hasRemotes: remotes.length > 0,
        remotes: remotes.slice(0, 3), // 限制返回数量
        latestCommit: commitResult.stdout.trim().substring(0, 8),
      };
    } catch (error) {
      return {
        hasRemotes: false,
        remotes: [],
        latestCommit: null,
      };
    }
  }

  /**
   * 分析变化
   */
  private analyzeChanges(beforeStatus: any, afterStatus: any): any {
    if (beforeStatus === afterStatus) {
      return { isDryRun: true };
    }

    return {
      stagedFiles: afterStatus.summary.added - beforeStatus.summary.added,
      removedFromWorking: beforeStatus.summary.total - afterStatus.summary.total,
      summary: `添加了 ${afterStatus.summary.added - beforeStatus.summary.added} 个文件到暂存区`,
    };
  }
}
