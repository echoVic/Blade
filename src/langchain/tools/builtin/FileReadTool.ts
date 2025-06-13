/**
 * 文件读取工具 - LangChain 实现
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import type { BladeToolResult, ToolExecutionContext } from '../types.js';

/**
 * 文件读取工具
 *
 * 提供安全的文件读取功能：
 * - 文件大小限制
 * - 路径安全检查
 * - 编码支持
 * - 文件信息返回
 */
export class FileReadTool extends BladeTool {
  constructor() {
    super({
      name: 'file_read',
      description: '读取文件内容，支持多种编码格式',
      category: 'filesystem',
      tags: ['file', 'read', 'content', 'filesystem'],
      version: '2.0.0',
      riskLevel: 'safe',
      requiresConfirmation: false,
    });
  }

  /**
   * 参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().min(1, 'File path cannot be empty').describe('文件路径（相对或绝对路径）'),
      encoding: z.enum(['utf8', 'base64', 'hex']).default('utf8').describe('文件编码格式'),
      maxSize: z
        .number()
        .min(1)
        .max(100 * 1024 * 1024) // 100MB
        .default(1024 * 1024) // 1MB
        .describe('最大文件大小（字节）'),
    });
  }

  /**
   * 执行文件读取
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { path, encoding, maxSize } = params;

    try {
      // 解析并验证路径
      const resolvedPath = resolve(path);

      // 安全检查：确保不能访问系统敏感目录
      await this.validatePath(resolvedPath);

      // 检查文件是否存在
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        return {
          success: false,
          error: `指定路径不是文件: ${path}`,
          metadata: {
            executionId: context.executionId,
            path: resolvedPath,
            isDirectory: stats.isDirectory(),
          },
        };
      }

      // 检查文件大小
      if (stats.size > maxSize) {
        return {
          success: false,
          error: `文件太大 (${this.formatFileSize(stats.size)})，超过限制 (${this.formatFileSize(maxSize)})`,
          metadata: {
            executionId: context.executionId,
            path: resolvedPath,
            fileSize: stats.size,
            maxSize,
          },
        };
      }

      // 读取文件内容
      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);

      return {
        success: true,
        data: {
          path: resolvedPath,
          content,
          encoding,
          size: stats.size,
          sizeFormatted: this.formatFileSize(stats.size),
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString(),
          fileInfo: {
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            mode: stats.mode,
            uid: stats.uid,
            gid: stats.gid,
          },
        },
        metadata: {
          executionId: context.executionId,
          toolName: this.name,
          category: this.category,
          operation: 'file_read',
          performance: {
            fileSize: stats.size,
            encoding,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: `文件读取失败: ${errorMessage}`,
        metadata: {
          executionId: context.executionId,
          path,
          originalError: errorMessage,
          operation: 'file_read',
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
      '{"path": "package.json"}',
      '{"path": "README.md", "encoding": "utf8"}',
      '{"path": "image.png", "encoding": "base64"}',
      '{"path": "large-file.txt", "maxSize": 5242880}',
    ];
  }

  /**
   * 获取工具帮助信息
   */
  public getHelp(): string {
    return `
${super.getHelp()}

参数说明:
- path: 要读取的文件路径（必需）
- encoding: 文件编码（可选，默认 utf8）
  - utf8: 文本文件
  - base64: 二进制文件编码
  - hex: 十六进制编码
- maxSize: 最大文件大小限制（可选，默认 1MB）

安全特性:
- 自动检测和阻止路径遍历攻击
- 限制访问系统敏感目录
- 文件大小限制保护
- 详细的错误信息和元数据

使用示例:
${this.getExamples()
  .map(example => `  ${example}`)
  .join('\n')}
    `.trim();
  }
}
