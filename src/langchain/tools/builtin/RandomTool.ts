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
 * 随机数生成工具
 * 生成各种类型的随机数据，包括数字、字符串、布尔值等
 */
export class RandomTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'random',
      description: '生成随机数据，支持数字、字符串、布尔值等多种类型',
      category: ToolCategory.UTILITY,
      tags: ['random', 'number', 'string', 'generator', 'utility'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      type: z.enum(['number', 'string', 'boolean', 'array', 'choice']).default('number'),
      min: z.number().default(0),
      max: z.number().default(100),
      length: z.number().min(1).max(10000).default(10),
      count: z.number().min(1).max(1000).default(1),
      charset: z
        .enum(['alphanumeric', 'alpha', 'numeric', 'lowercase', 'uppercase', 'symbols', 'custom'])
        .default('alphanumeric'),
      customCharset: z.string().optional(),
      choices: z.array(z.any()).optional(),
      includeNegative: z.boolean().default(false),
      precision: z.number().min(0).max(10).default(0),
      secure: z.boolean().default(false),
    });
  }

  protected async executeInternal(
    params: {
      type?: string;
      min?: number;
      max?: number;
      length?: number;
      count?: number;
      charset?: string;
      customCharset?: string;
      choices?: any[];
      includeNegative?: boolean;
      precision?: number;
      secure?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      type = 'number',
      min = 0,
      max = 100,
      length = 10,
      count = 1,
      charset = 'alphanumeric',
      customCharset,
      choices,
      includeNegative = false,
      precision = 0,
      secure = false,
    } = params;
    const startTime = Date.now();

    try {
      let results: any[] = [];

      for (let i = 0; i < count; i++) {
        let result: any;

        switch (type) {
          case 'number':
            result = this.generateRandomNumber(min, max, precision, includeNegative, secure);
            break;
          case 'string':
            result = this.generateRandomString(length, charset, customCharset, secure);
            break;
          case 'boolean':
            result = this.generateRandomBoolean();
            break;
          case 'array':
            result = this.generateRandomArray(length, min, max);
            break;
          case 'choice':
            result = this.generateRandomChoice(choices);
            break;
          default:
            throw new Error(`不支持的随机类型: ${type}`);
        }

        results.push(result);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          type,
          count,
          results: count === 1 ? results[0] : results,
          metadata: {
            generationMethod: secure ? 'cryptographically secure' : 'pseudo-random',
            parameters: {
              type,
              min,
              max,
              length,
              charset: charset === 'custom' ? 'custom' : charset,
              precision,
              includeNegative,
            },
          },
          statistics: this.generateStatistics(results, type),
        },
        duration: executionTime,
        metadata: {
          operation: 'random',
          executionTime,
          executionId: context.executionId,
          generationType: type,
          isSecure: secure,
          outputCount: count,
          randomConfig: {
            type,
            min,
            max,
            length,
            charset,
            precision,
            includeNegative,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `随机数生成失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'random',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          failedConfig: {
            type,
            count,
            parameters: params,
          },
        },
      };
    }
  }

  /**
   * 生成随机数字
   */
  private generateRandomNumber(
    min: number,
    max: number,
    precision: number,
    includeNegative: boolean,
    secure: boolean
  ): number {
    let result: number;

    if (secure) {
      const crypto = require('crypto');
      const randomBytes = crypto.randomBytes(4);
      const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff;
      result = min + (max - min) * randomValue;
    } else {
      result = Math.random() * (max - min) + min;
    }

    if (includeNegative && Math.random() < 0.5) {
      result = -result;
    }

    if (precision > 0) {
      result = Number(result.toFixed(precision));
    } else {
      result = Math.round(result);
    }

    return result;
  }

  /**
   * 生成随机字符串
   */
  private generateRandomString(
    length: number,
    charset: string,
    customCharset?: string,
    secure: boolean = false
  ): string {
    let chars: string;

    switch (charset) {
      case 'alphanumeric':
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        break;
      case 'alpha':
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        break;
      case 'numeric':
        chars = '0123456789';
        break;
      case 'lowercase':
        chars = 'abcdefghijklmnopqrstuvwxyz';
        break;
      case 'uppercase':
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        break;
      case 'symbols':
        chars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        break;
      case 'custom':
        chars = customCharset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        break;
      default:
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }

    let result = '';

    if (secure) {
      const crypto = require('crypto');
      for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        result += chars[randomIndex];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }

    return result;
  }

  /**
   * 生成随机布尔值
   */
  private generateRandomBoolean(): boolean {
    return Math.random() < 0.5;
  }

  /**
   * 生成随机数组
   */
  private generateRandomArray(length: number, min: number, max: number): number[] {
    const array: number[] = [];
    for (let i = 0; i < length; i++) {
      array.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return array;
  }

  /**
   * 从选项中随机选择
   */
  private generateRandomChoice(choices?: any[]): any {
    if (!choices || choices.length === 0) {
      throw new Error('随机选择需要提供 choices 参数');
    }
    const randomIndex = Math.floor(Math.random() * choices.length);
    return choices[randomIndex];
  }

  /**
   * 生成统计信息
   */
  private generateStatistics(results: any[], type: string): any {
    if (type === 'number' && Array.isArray(results) && results.length > 1) {
      const numbers = results.filter(r => typeof r === 'number');
      if (numbers.length > 0) {
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const sorted = [...numbers].sort((a, b) => a - b);

        return {
          count: numbers.length,
          sum,
          average: Number(avg.toFixed(2)),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          median:
            sorted.length % 2 === 0
              ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
              : sorted[Math.floor(sorted.length / 2)],
        };
      }
    }

    if (type === 'string' && Array.isArray(results) && results.length > 1) {
      const strings = results.filter(r => typeof r === 'string');
      if (strings.length > 0) {
        const lengths = strings.map(s => s.length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

        return {
          count: strings.length,
          averageLength: Number(avgLength.toFixed(2)),
          minLength: Math.min(...lengths),
          maxLength: Math.max(...lengths),
          totalCharacters: lengths.reduce((a, b) => a + b, 0),
        };
      }
    }

    return {
      count: Array.isArray(results) ? results.length : 1,
      type: typeof results[0],
    };
  }
}
