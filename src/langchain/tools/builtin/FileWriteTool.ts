/**
 * 文件写入工具 - LangChain 原生实现
 */

import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import type { BladeToolResult, ToolExecutionContext } from '../types.js';

/**
 * 文件写入工具
 *
 * 提供安全的文件写入功能：
 * - 路径安全检查
 * - 目录自动创建
 * - 备份现有文件
 * - 覆盖确认机制
 */
export class FileWriteTool extends BladeTool {
  constructor() {
    super({
      name: 'file_write',
      description: '写入文件内容，支持创建目录和备份',
      category: 'filesystem',
      tags: ['file', 'write', 'create', 'filesystem'],
      version: '2.0.0',
      riskLevel: 'high',
      requiresConfirmation: true,
    });
  }

  /**
   * 参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().min(1, 'File path cannot be empty').describe('文件路径'),
      content: z.string().describe('文件内容'),
      encoding: z.enum(['utf8', 'base64', 'hex']).default('utf8').describe('文件编码格式'),
      createDirectories: z.boolean().default(true).describe('是否自动创建目录'),
      overwrite: z.boolean().default(false).describe('是否覆盖已存在的文件'),
      backup: z.boolean().default(true).describe('覆盖时是否创建备份'),
    });
  }

  /**
   * 执行文件写入
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { path, content, encoding, createDirectories, overwrite, backup } = params;

    try {
      // 解析并验证路径
      const resolvedPath = resolve(path);

      // 安全检查
      await this.validatePath(resolvedPath);

      // 检查文件是否已存在
      const fileExists = await this.fileExists(resolvedPath);

      if (fileExists && !overwrite) {
        return {
          success: false,
          error: `文件已存在且未设置覆盖: ${path}`,
          metadata: {
            executionId: context.executionId,
            path: resolvedPath,
            fileExists: true,
          },
        };
      }

      // 创建备份
      let backupPath: string | undefined;
      if (fileExists && backup) {
        backupPath = await this.createBackup(resolvedPath);
      }

      // 创建目录结构
      if (createDirectories) {
        const dir = dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // 写入文件
      await fs.writeFile(resolvedPath, content, encoding as BufferEncoding);

      // 获取文件信息
      const stats = await fs.stat(resolvedPath);

      return {
        success: true,
        data: {
          path: resolvedPath,
          size: stats.size,
          sizeFormatted: this.formatFileSize(stats.size),
          encoding,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          backupPath,
          overwritten: fileExists,
        },
        metadata: {
          executionId: context.executionId,
          toolName: this.name,
          category: this.category,
          operation: 'file_write',
          performance: {
            contentLength: content.length,
            encoding,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: `文件写入失败: ${errorMessage}`,
        metadata: {
          executionId: context.executionId,
          path,
          originalError: errorMessage,
          operation: 'file_write',
        },
      };
    }
  }

  /**
   * 验证文件路径安全性
   */
  private async validatePath(resolvedPath: string): Promise<void> {
    // 检查路径是否包含危险模式
    const dangerousPatterns = [
      '/etc/',
      '/proc/',
      '/sys/',
      '/dev/',
      '/root/',
      'C:\\Windows\\',
      'C:\\System32\\',
    ];

    for (const pattern of dangerousPatterns) {
      if (resolvedPath.includes(pattern)) {
        throw new Error(`Access to system directory not allowed: ${pattern}`);
      }
    }

    // 检查是否尝试访问上级目录
    if (resolvedPath.includes('..')) {
      throw new Error('Path traversal detected (..)');
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建备份文件
   */
  private async createBackup(originalPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${originalPath}.backup.${timestamp}`;

    await fs.copyFile(originalPath, backupPath);
    return backupPath;
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
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
- backup: 覆盖时是否创建备份（可选，默认 true）

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
