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
 * Base64 编码解码工具
 * 支持文本和文件的 Base64 编码、解码操作
 */
export class Base64Tool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'base64',
      description: '进行 Base64 编码和解码操作，支持文本和文件',
      category: ToolCategory.UTILITY,
      tags: ['base64', 'encode', 'decode', 'text', 'utility'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      operation: z.enum(['encode', 'decode']).default('encode'),
      input: z.string().min(1, '输入内容不能为空'),
      inputType: z.enum(['text', 'file']).default('text'),
      outputFormat: z.enum(['standard', 'url-safe', 'mime']).default('standard'),
      lineLength: z.number().positive().max(1024).optional(),
      removePadding: z.boolean().default(false),
    });
  }

  protected async executeInternal(
    params: {
      operation?: string;
      input: string;
      inputType?: string;
      outputFormat?: string;
      lineLength?: number;
      removePadding?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      operation = 'encode',
      input,
      inputType = 'text',
      outputFormat = 'standard',
      lineLength,
      removePadding = false,
    } = params;
    const startTime = Date.now();

    try {
      let result: string;
      let inputData: Buffer;
      let outputData: string | Buffer;
      const inputSize = Buffer.byteLength(input, 'utf8');

      // 准备输入数据
      if (inputType === 'file') {
        // 文件路径输入
        const fs = await import('fs/promises');
        const { resolve } = await import('path');

        try {
          const filePath = resolve(input);
          inputData = await fs.readFile(filePath);
        } catch (error: any) {
          return {
            success: false,
            error: `文件读取失败: ${error.message}`,
            metadata: {
              operation: 'base64',
              inputType,
              filePath: input,
              executionTime: Date.now() - startTime,
            },
          };
        }
      } else {
        // 文本输入
        inputData = Buffer.from(input, 'utf8');
      }

      // 执行编码或解码
      if (operation === 'encode') {
        result = this.encodeBase64(inputData, outputFormat, lineLength, removePadding);
        outputData = result;
      } else {
        try {
          outputData = this.decodeBase64(input, outputFormat);
          result = outputData.toString('utf8');
        } catch (error: any) {
          return {
            success: false,
            error: `Base64 解码失败: ${error.message}`,
            metadata: {
              operation: 'base64',
              subOperation: 'decode',
              executionTime: Date.now() - startTime,
            },
          };
        }
      }

      const executionTime = Date.now() - startTime;
      const outputSize = Buffer.byteLength(result, 'utf8');

      // 预览处理（如果输出过长）
      const maxPreviewLength = 1000;
      const resultPreview =
        result.length > maxPreviewLength
          ? result.substring(0, maxPreviewLength) + '... (截断)'
          : result;

      return {
        success: true,
        data: {
          operation,
          input: input.length > 200 ? input.substring(0, 200) + '... (截断)' : input,
          result: resultPreview,
          fullResult: result, // 完整结果
          inputType,
          outputFormat,
          options: {
            lineLength: lineLength || null,
            removePadding,
          },
          statistics: {
            inputSize,
            outputSize,
            compressionRatio:
              operation === 'encode' ? outputSize / inputSize : inputSize / outputSize,
            sizeChange: outputSize - inputSize,
          },
          validation: this.validateBase64(operation === 'encode' ? result : input),
        },
        duration: executionTime,
        metadata: {
          operation: 'base64',
          executionTime,
          executionId: context.executionId,
          processingConfig: {
            operation,
            inputType,
            outputFormat,
            lineLength: lineLength || null,
            removePadding,
          },
          performance: {
            bytesProcessed: inputSize,
            processingRate: Math.round((inputSize / executionTime) * 1000), // bytes per second
            efficiency: outputSize > 0 ? inputSize / outputSize : 0,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `Base64 操作失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'base64',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          processingConfig: {
            operation,
            inputType,
            outputFormat,
          },
        },
      };
    }
  }

  /**
   * Base64 编码
   */
  private encodeBase64(
    data: Buffer,
    format: string,
    lineLength?: number,
    removePadding: boolean = false
  ): string {
    let result = data.toString('base64');

    // 处理不同格式
    switch (format) {
      case 'url-safe':
        result = result.replace(/\+/g, '-').replace(/\//g, '_');
        break;
      case 'mime':
        // MIME 格式通常有76字符的行长度
        lineLength = lineLength || 76;
        break;
      case 'standard':
      default:
        // 标准格式
        break;
    }

    // 移除填充
    if (removePadding) {
      result = result.replace(/=+$/, '');
    }

    // 添加行分隔符
    if (lineLength && lineLength > 0) {
      result = this.addLineBreaks(result, lineLength);
    }

    return result;
  }

  /**
   * Base64 解码
   */
  private decodeBase64(data: string, format: string): Buffer {
    let cleanData = data.replace(/\s/g, ''); // 移除所有空白字符

    // 处理不同格式
    switch (format) {
      case 'url-safe':
        cleanData = cleanData.replace(/-/g, '+').replace(/_/g, '/');
        break;
    }

    // 添加必要的填充
    const padding = cleanData.length % 4;
    if (padding > 0) {
      cleanData += '='.repeat(4 - padding);
    }

    return Buffer.from(cleanData, 'base64');
  }

  /**
   * 添加行分隔符
   */
  private addLineBreaks(text: string, lineLength: number): string {
    const result: string[] = [];
    for (let i = 0; i < text.length; i += lineLength) {
      result.push(text.substring(i, i + lineLength));
    }
    return result.join('\n');
  }

  /**
   * 验证 Base64 字符串
   */
  private validateBase64(data: string): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // 检查字符集
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const urlSafeRegex = /^[A-Za-z0-9\-_]*={0,2}$/;

    if (!base64Regex.test(data.replace(/\s/g, '')) && !urlSafeRegex.test(data.replace(/\s/g, ''))) {
      issues.push('包含无效的 Base64 字符');
      score -= 50;
    }

    // 检查长度（应该是4的倍数，除去空白字符）
    const cleanData = data.replace(/\s/g, '');
    if (cleanData.length % 4 !== 0) {
      issues.push('长度不是4的倍数');
      score -= 20;
    }

    // 检查填充
    const paddingMatch = cleanData.match(/=*$/);
    const paddingLength = paddingMatch ? paddingMatch[0].length : 0;
    if (paddingLength > 2) {
      issues.push('填充字符过多');
      score -= 15;
    }

    // 检查填充位置
    if (paddingLength > 0 && cleanData.indexOf('=') !== cleanData.length - paddingLength) {
      issues.push('填充字符位置错误');
      score -= 15;
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score),
    };
  }
}
