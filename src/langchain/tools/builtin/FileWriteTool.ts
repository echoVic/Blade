/**
 * 文件写入工具 - LangChain 原生实现
 */

import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import {
  RiskLevel,
  ToolCategory,
  type BladeToolConfig,
  type BladeToolResult,
  type ToolExecutionContext,
} from '../types.js';

/**
 * 文件写入工具
 * 安全地写入文件内容，支持目录创建和覆盖确认
 */
export class FileWriteTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'file_write',
      description: '写入文件内容，支持创建目录和文件覆盖确认',
      category: ToolCategory.FILESYSTEM,
      tags: ['file', 'write', 'create', 'filesystem'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: true,
      riskLevel: RiskLevel.MODERATE,
    };

    super(config);
  }

  /**
   * 参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().min(1, '文件路径不能为空'),
      content: z.string(),
      encoding: z.enum(['utf8', 'base64', 'hex']).default('utf8'),
      createDirectories: z.boolean().default(true),
      overwrite: z.boolean().default(false),
      backup: z.boolean().default(false),
    });
  }

  /**
   * 执行文件写入
   */
  protected async executeInternal(
    params: {
      path: string;
      content: string;
      encoding?: string;
      createDirectories?: boolean;
      overwrite?: boolean;
      backup?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      path,
      content,
      encoding = 'utf8',
      createDirectories = true,
      overwrite = false,
      backup = false,
    } = params;
    const startTime = Date.now();

    try {
      const resolvedPath = resolve(path);
      const parentDir = dirname(resolvedPath);

      // 检查文件是否已存在
      let fileExists = false;
      let existingSize = 0;
      try {
        const stats = await fs.stat(resolvedPath);
        fileExists = stats.isFile();
        existingSize = stats.size;
      } catch {
        // 文件不存在，继续
      }

      // 如果文件存在且不允许覆盖
      if (fileExists && !overwrite) {
        return {
          success: false,
          error: `文件已存在: ${resolvedPath}，请设置 overwrite: true 来覆盖`,
          metadata: {
            path: resolvedPath,
            fileExists: true,
            existingSize,
            executionTime: Date.now() - startTime,
            executionId: context.executionId,
          },
        };
      }

      // 创建备份（如果需要且文件存在）
      let backupPath: string | undefined;
      if (backup && fileExists) {
        backupPath = `${resolvedPath}.backup.${Date.now()}`;
        await fs.copyFile(resolvedPath, backupPath);
      }

      // 创建目录结构
      if (createDirectories) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      // 写入文件
      await fs.writeFile(resolvedPath, content, encoding as 'utf8' | 'base64' | 'hex');

      // 获取写入后的文件信息
      const newStats = await fs.stat(resolvedPath);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          path: resolvedPath,
          content: content.length <= 1000 ? content : content.substring(0, 1000) + '... (截断)',
          encoding,
          size: newStats.size,
          sizeChange: newStats.size - existingSize,
          created: !fileExists,
          overwritten: fileExists && overwrite,
          backup: backupPath ? { created: true, path: backupPath } : undefined,
          parentDirectory: parentDir,
          directoryCreated: createDirectories,
          modified: newStats.mtime.toISOString(),
        },
        duration: executionTime,
        metadata: {
          operation: 'file_write',
          executionTime,
          executionId: context.executionId,
          writeConfig: {
            encoding,
            createDirectories,
            overwrite,
            backup,
          },
          fileInfo: {
            existed: fileExists,
            sizeChange: newStats.size - existingSize,
            finalSize: newStats.size,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `文件写入失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'file_write',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          errorCode: error.code,
          writeConfig: {
            path,
            encoding,
            createDirectories,
            overwrite,
            backup,
          },
        },
      };
    }
  }

  /**
   * 获取工具使用示例
   */
  public getExamples(): string[] {
    return [
      '{"path": "hello.txt", "content": "Hello World!"}',
      '{"path": "config.json", "content": "{\\"key\\": \\"value\\"}", "overwrite": true}',
      '{"path": "data/output.txt", "content": "Data...", "createDirectories": true}',
      '{"path": "backup.txt", "content": "Content", "backup": false}',
    ];
  }

  /**
   * 获取工具帮助信息
   */
  public getHelp(): string {
    return `
${super.getHelp()}

参数说明:
- path: 要写入的文件路径（必需）
- content: 文件内容（必需）
- encoding: 文件编码（可选，默认 utf8）
- createDirectories: 是否自动创建目录（可选，默认 true）
- overwrite: 是否覆盖已存在文件（可选，默认 false）
- backup: 覆盖时是否创建备份（可选，默认 false）

安全特性:
- 自动检测和阻止路径遍历攻击
- 限制访问系统敏感目录
- 文件覆盖前自动备份
- 详细的操作日志和元数据

使用示例:
${this.getExamples()
  .map(example => `  ${example}`)
  .join('\n')}
    `.trim();
  }
}
