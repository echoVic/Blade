/**
 * 时间戳工具 - LangChain 原生实现
 */

import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import type { BladeToolResult, ToolExecutionContext } from '../types.js';

/**
 * 时间戳工具
 *
 * 提供时间相关的实用功能：
 * - 获取当前时间戳
 * - 时间格式转换
 * - 时区处理
 * - 时间计算
 */
export class TimestampTool extends BladeTool {
  constructor() {
    super({
      name: 'timestamp',
      description: '时间戳工具，支持时间获取、转换和计算',
      category: 'utility',
      tags: ['time', 'timestamp', 'date', 'utility'],
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
      action: z
        .enum(['current', 'format', 'parse', 'calculate'])
        .default('current')
        .describe('操作类型'),
      timestamp: z.number().optional().describe('时间戳（毫秒）'),
      format: z.string().optional().describe('时间格式'),
      timezone: z.string().optional().describe('时区'),
      calculation: z
        .object({
          operation: z.enum(['add', 'subtract']),
          amount: z.number(),
          unit: z.enum([
            'milliseconds',
            'seconds',
            'minutes',
            'hours',
            'days',
            'weeks',
            'months',
            'years',
          ]),
        })
        .optional()
        .describe('时间计算'),
    });
  }

  /**
   * 执行时间戳操作
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { action, timestamp, format, timezone, calculation } = params;

    try {
      let result: any;

      switch (action) {
        case 'current':
          result = this.getCurrentTime(timezone);
          break;

        case 'format':
          if (!timestamp) {
            throw new Error('timestamp is required for format action');
          }
          result = this.formatTime(timestamp, format, timezone);
          break;

        case 'parse':
          if (!format) {
            throw new Error('format is required for parse action');
          }
          result = this.parseTime(format, timezone);
          break;

        case 'calculate':
          if (!timestamp || !calculation) {
            throw new Error('timestamp and calculation are required for calculate action');
          }
          result = this.calculateTime(timestamp, calculation);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          executionId: context.executionId,
          toolName: this.name,
          category: this.category,
          operation: `timestamp_${action}`,
          performance: {
            action,
            timezone: timezone || 'UTC',
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: `时间戳操作失败: ${errorMessage}`,
        metadata: {
          executionId: context.executionId,
          action,
          originalError: errorMessage,
          operation: `timestamp_${action}`,
        },
      };
    }
  }

  /**
   * 获取当前时间
   */
  private getCurrentTime(timezone?: string): any {
    const now = new Date();
    const timestamp = now.getTime();

    const result: any = {
      timestamp,
      timestampSeconds: Math.floor(timestamp / 1000),
      iso: now.toISOString(),
      utc: now.toUTCString(),
      local: now.toString(),
    };

    // 添加时区信息
    if (timezone) {
      try {
        result.timezone = {
          name: timezone,
          formatted: now.toLocaleString('en-US', { timeZone: timezone }),
          offset: this.getTimezoneOffset(now, timezone),
        };
      } catch (error) {
        result.timezoneError = `Invalid timezone: ${timezone}`;
      }
    }

    return result;
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: number, format?: string, timezone?: string): any {
    const date = new Date(timestamp);

    const result: any = {
      timestamp,
      iso: date.toISOString(),
      utc: date.toUTCString(),
      local: date.toString(),
    };

    // 自定义格式
    if (format) {
      result.custom = this.customFormat(date, format);
    }

    // 时区格式
    if (timezone) {
      try {
        result.timezone = {
          name: timezone,
          formatted: date.toLocaleString('en-US', { timeZone: timezone }),
          offset: this.getTimezoneOffset(date, timezone),
        };
      } catch (error) {
        result.timezoneError = `Invalid timezone: ${timezone}`;
      }
    }

    return result;
  }

  /**
   * 解析时间字符串
   */
  private parseTime(timeString: string, timezone?: string): any {
    let date: Date;

    try {
      date = new Date(timeString);

      if (isNaN(date.getTime())) {
        throw new Error('Invalid date string');
      }
    } catch (error) {
      throw new Error(`Failed to parse time string: ${timeString}`);
    }

    return this.formatTime(date.getTime(), undefined, timezone);
  }

  /**
   * 时间计算
   */
  private calculateTime(timestamp: number, calculation: any): any {
    const { operation, amount, unit } = calculation;
    const date = new Date(timestamp);

    let milliseconds = 0;

    switch (unit) {
      case 'milliseconds':
        milliseconds = amount;
        break;
      case 'seconds':
        milliseconds = amount * 1000;
        break;
      case 'minutes':
        milliseconds = amount * 60 * 1000;
        break;
      case 'hours':
        milliseconds = amount * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = amount * 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
        break;
      case 'months':
        // 近似计算（30天）
        milliseconds = amount * 30 * 24 * 60 * 60 * 1000;
        break;
      case 'years':
        // 近似计算（365天）
        milliseconds = amount * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    const newTimestamp = operation === 'add' ? timestamp + milliseconds : timestamp - milliseconds;

    return {
      original: {
        timestamp,
        formatted: new Date(timestamp).toISOString(),
      },
      calculation: {
        operation,
        amount,
        unit,
        milliseconds,
      },
      result: {
        timestamp: newTimestamp,
        formatted: new Date(newTimestamp).toISOString(),
      },
      difference: {
        milliseconds: Math.abs(newTimestamp - timestamp),
        seconds: Math.abs(newTimestamp - timestamp) / 1000,
        minutes: Math.abs(newTimestamp - timestamp) / (1000 * 60),
        hours: Math.abs(newTimestamp - timestamp) / (1000 * 60 * 60),
        days: Math.abs(newTimestamp - timestamp) / (1000 * 60 * 60 * 24),
      },
    };
  }

  /**
   * 自定义时间格式
   */
  private customFormat(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 获取时区偏移
   */
  private getTimezoneOffset(date: Date, timezone: string): string {
    try {
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      const targetTime = new Date(utc + this.getTimezoneOffsetMs(timezone));
      const offset = (targetTime.getTime() - date.getTime()) / (1000 * 60 * 60);
      return offset >= 0 ? `+${offset}` : String(offset);
    } catch {
      return 'unknown';
    }
  }

  /**
   * 获取时区偏移毫秒数
   */
  private getTimezoneOffsetMs(timezone: string): number {
    // 简化实现，实际应该使用更精确的时区库
    const offsetMap: Record<string, number> = {
      UTC: 0,
      'Asia/Shanghai': 8 * 60 * 60 * 1000,
      'America/New_York': -5 * 60 * 60 * 1000,
      'Europe/London': 0,
    };

    return offsetMap[timezone] || 0;
  }

  /**
   * 获取工具使用示例
   */
  public getExamples(): string[] {
    return [
      '{"action": "current"}',
      '{"action": "current", "timezone": "Asia/Shanghai"}',
      '{"action": "format", "timestamp": 1640995200000, "format": "YYYY-MM-DD HH:mm:ss"}',
      '{"action": "calculate", "timestamp": 1640995200000, "calculation": {"operation": "add", "amount": 7, "unit": "days"}}',
    ];
  }

  /**
   * 获取工具帮助信息
   */
  public getHelp(): string {
    return `
${super.getHelp()}

参数说明:
- action: 操作类型（current/format/parse/calculate）
- timestamp: 时间戳毫秒数（可选）
- format: 时间格式字符串（可选）
- timezone: 时区（可选）
- calculation: 时间计算配置（可选）

支持的操作:
- current: 获取当前时间
- format: 格式化时间戳
- parse: 解析时间字符串
- calculate: 时间计算

格式化占位符:
- YYYY: 四位年份
- MM: 两位月份
- DD: 两位日期
- HH: 两位小时
- mm: 两位分钟
- ss: 两位秒数

使用示例:
${this.getExamples()
  .map(example => `  ${example}`)
  .join('\n')}
    `.trim();
  }
}
