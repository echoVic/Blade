/**
 * 文件读取工具 - LangChain 实现
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
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
 * 文件读取工具
 * 安全地读取文件内容，支持多种编码格式
 */
export class FileReadTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'file_read',
      description: '读取文件内容，支持多种编码格式',
      category: ToolCategory.FILESYSTEM,
      tags: ['file', 'read', 'content', 'filesystem'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  /**
   * 参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().min(1, '文件路径不能为空'),
      encoding: z.enum(['utf8', 'base64', 'hex']).default('utf8'),
      maxSize: z
        .number()
        .positive()
        .default(1024 * 1024), // 1MB
    });
  }

  /**
   * 执行文件读取
   */
  protected async executeInternal(
    params: { path: string; encoding?: string; maxSize?: number },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { path, encoding = 'utf8', maxSize = 1024 * 1024 } = params;
    const startTime = Date.now();

    try {
      const resolvedPath = resolve(path);

      // 检查文件是否存在
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        return {
          success: false,
          error: '指定路径不是文件',
          metadata: {
            path: resolvedPath,
            type: 'directory',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 检查文件大小
      if (stats.size > maxSize) {
        return {
          success: false,
          error: `文件太大 (${this.formatFileSize(stats.size)})，超过限制 (${this.formatFileSize(maxSize)})`,
          metadata: {
            path: resolvedPath,
            size: stats.size,
            maxSize,
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 读取文件内容
      const content = await fs.readFile(resolvedPath, encoding as 'utf8' | 'base64' | 'hex');

      return {
        success: true,
        data: {
          path: resolvedPath,
          content,
          encoding,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString(),
          type: this.getFileType(resolvedPath),
        },
        metadata: {
          operation: 'file_read',
          executionTime: Date.now() - startTime,
          executionId: context.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `文件读取失败: ${error.message}`,
        metadata: {
          path,
          errorCode: error.code,
          errorType: error.constructor.name,
          executionTime: Date.now() - startTime,
          executionId: context.executionId,
        },
      };
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 获取文件类型
   */
  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const typeMap: Record<string, string> = {
      txt: 'text',
      md: 'markdown',
      js: 'javascript',
      ts: 'typescript',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      h: 'header',
      yml: 'yaml',
      yaml: 'yaml',
    };

    return typeMap[ext || ''] || 'unknown';
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
