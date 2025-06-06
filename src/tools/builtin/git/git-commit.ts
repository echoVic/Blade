import { exec } from 'child_process';
import { promisify } from 'util';
import {
  CommandPreCheckResult,
  ConfirmableToolBase,
  ConfirmationOptions,
  RiskLevel,
} from '../../base/ConfirmableToolBase.js';

const execAsync = promisify(exec);

/**
 * Git Commit 工具 (基于 ConfirmableToolBase)
 * 提交暂存区的更改，带用户确认功能
 */
class GitCommitTool extends ConfirmableToolBase {
  readonly name = 'git_commit';
  readonly description = '提交Git暂存区的更改（需要用户确认）';
  readonly category = 'git';
  readonly tags = ['git', 'commit', 'save', 'record'];

  readonly parameters = {
    path: {
      type: 'string' as const,
      required: false,
      description: '仓库路径，默认为当前目录',
      default: '.',
    },
    message: {
      type: 'string' as const,
      required: true,
      description: '提交信息',
      default: '',
    },
    all: {
      type: 'boolean' as const,
      required: false,
      description: '自动暂存所有已跟踪文件的更改',
      default: false,
    },
    amend: {
      type: 'boolean' as const,
      required: false,
      description: '修改最后一次提交',
      default: false,
    },
    author: {
      type: 'string' as const,
      required: false,
      description: '指定作者 (格式: "Name <email>")',
      default: '',
    },
    dryRun: {
      type: 'boolean' as const,
      required: false,
      description: '干运行，只显示将要提交的内容',
      default: false,
    },
    allowEmpty: {
      type: 'boolean' as const,
      required: false,
      description: '允许空提交',
      default: false,
    },
    skipConfirmation: {
      type: 'boolean' as const,
      required: false,
      description: '跳过用户确认直接执行',
      default: false,
    },
    riskLevel: {
      type: 'string' as const,
      required: false,
      description: '风险级别：safe, moderate, high, critical',
      default: 'moderate',
    },
  };

  readonly required = ['message'];

  /**
   * 预处理参数 - 验证提交信息和作者格式
   */
  protected async preprocessParameters(params: Record<string, any>): Promise<Record<string, any>> {
    const { message, author } = params;

    // 验证提交信息
    if (!message || message.trim().length === 0) {
      throw new Error('提交信息不能为空');
    }

    // 验证作者格式
    if (author && (!author.includes('<') || !author.includes('>'))) {
      throw new Error('作者格式应为 "Name <email>"');
    }

    return params;
  }

  /**
   * 构建 Git commit 命令
   */
  protected async buildCommand(params: Record<string, any>): Promise<string> {
    const { message, all, amend, author, dryRun, allowEmpty } = params;

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
      command += ` --author="${author}"`;
    }

    // 添加提交信息
    command += ` -m "${message.replace(/"/g, '\\"')}"`;

    return command;
  }

  /**
   * 获取确认选项 - 根据操作类型设置不同的风险级别
   */
  protected getConfirmationOptions(params: Record<string, any>): ConfirmationOptions {
    const baseOptions = super.getConfirmationOptions(params);

    // 根据操作类型调整风险级别
    let riskLevel = baseOptions.riskLevel || RiskLevel.MODERATE;

    if (params.amend) {
      riskLevel = RiskLevel.HIGH; // 修改提交的风险较高
    } else if (params.allowEmpty) {
      riskLevel = RiskLevel.MODERATE; // 空提交风险中等
    } else if (params.dryRun) {
      riskLevel = RiskLevel.SAFE; // 干运行很安全
    }

    return {
      ...baseOptions,
      riskLevel,
      confirmMessage: this.getCustomConfirmMessage(params),
    };
  }

  /**
   * 获取自定义确认消息
   */
  private getCustomConfirmMessage(params: Record<string, any>): string {
    if (params.amend) {
      return '⚠️  这将修改最后一次提交，是否继续？';
    } else if (params.allowEmpty) {
      return '这是一个空提交，是否继续？';
    } else if (params.dryRun) {
      return '执行干运行预览提交内容？';
    } else {
      return '是否提交这些更改？';
    }
  }

  /**
   * 预检查命令 - 检查是否有更改可以提交
   */
  protected async preCheckCommand(
    command: string,
    workingDirectory: string,
    params: Record<string, any>
  ): Promise<CommandPreCheckResult> {
    const { amend, allowEmpty, dryRun, all } = params;

    try {
      // 检查是否在 Git 仓库中
      await execAsync('git rev-parse --git-dir', { cwd: workingDirectory });

      // 如果不是 amend、allowEmpty 或 dryRun，检查是否有可提交的更改
      if (!amend && !allowEmpty && !dryRun) {
        const { stdout: statusOutput } = await execAsync('git status --porcelain', {
          cwd: workingDirectory,
          timeout: 5000,
        });

        const hasStaged = statusOutput
          .split('\n')
          .some(line => line.trim() && line[0] !== ' ' && line[0] !== '?');

        if (!hasStaged && !all) {
          // 检查是否有未暂存的更改
          const hasUnstaged = statusOutput
            .split('\n')
            .some(line => line.trim() && line[1] !== ' ' && line[0] !== '?');

          if (hasUnstaged) {
            return {
              valid: false,
              message: '没有暂存的更改，但有未暂存的文件',
              suggestions: [
                {
                  command: await this.buildCommand({ ...params, all: true }),
                  description: '提交所有已跟踪文件的更改',
                  riskLevel: RiskLevel.MODERATE,
                },
                {
                  command: 'git add .',
                  description: '先暂存所有更改',
                  riskLevel: RiskLevel.SAFE,
                },
              ],
            };
          }

          return {
            valid: false,
            message: '没有更改可以提交',
            suggestions: [
              {
                command: await this.buildCommand({ ...params, allowEmpty: true }),
                description: '创建空提交',
                riskLevel: RiskLevel.MODERATE,
              },
            ],
          };
        }
      }

      return { valid: true };
    } catch (error: any) {
      if (error.message.includes('not a git repository')) {
        return {
          valid: false,
          message: '当前目录不是 Git 仓库',
          suggestions: [
            {
              command: 'git init',
              description: '初始化 Git 仓库',
              riskLevel: RiskLevel.SAFE,
            },
          ],
        };
      }

      return {
        valid: false,
        message: `Git 预检查失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取执行描述
   */
  protected getExecutionDescription(params: Record<string, any>): string {
    const { message, amend, dryRun, allowEmpty, all } = params;

    let description = `提交消息: "${message}"`;

    if (amend) {
      description += ' (修改最后一次提交)';
    }

    if (dryRun) {
      description += ' (仅预览，不实际提交)';
    }

    if (allowEmpty) {
      description += ' (允许空提交)';
    }

    if (all) {
      description += ' (包含所有已跟踪文件)';
    }

    return description;
  }

  /**
   * 获取执行预览
   */
  protected async getExecutionPreview(
    command: string,
    workingDirectory: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: Record<string, any>
  ): Promise<string> {
    try {
      // 显示当前状态
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: workingDirectory,
        timeout: 5000,
      });

      if (!statusOutput.trim()) {
        return '没有更改';
      }

      let preview = '将要提交的文件:\n';
      const lines = statusOutput.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        let statusText = '';
        if (status.includes('M')) statusText = '修改';
        else if (status.includes('A')) statusText = '新增';
        else if (status.includes('D')) statusText = '删除';
        else if (status.includes('R')) statusText = '重命名';
        else statusText = '其他';

        preview += `  ${statusText}: ${file}\n`;
      }

      return preview;
    } catch (error) {
      return '无法获取预览信息';
    }
  }

  /**
   * 后处理结果 - 解析提交结果
   */
  protected async postProcessResult(
    result: { stdout: string; stderr: string },
    params: Record<string, any>
  ): Promise<any> {
    const output = result.stdout.trim();

    if (params.dryRun) {
      return {
        type: 'dry-run',
        previewMessage: params.message,
        output,
      };
    }

    // 解析提交结果
    const lines = output.split('\n');
    let commitHash = '';
    let commitSummary = '';

    // 提取提交hash和摘要
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

    return {
      type: 'commit',
      commitHash,
      commitSummary,
      message: params.message,
      statistics: {
        filesChanged,
        insertions,
        deletions,
      },
      rawOutput: output,
    };
  }
}

// 导出工具实例
export const gitCommit = new GitCommitTool();
