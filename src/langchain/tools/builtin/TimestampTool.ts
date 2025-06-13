/**
 * 时间戳工具 - LangChain 原生实现
 */

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
 * 时间戳工具
 * 处理时间相关操作，包括时间戳生成、解析和格式化
 */
export class TimestampTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'timestamp',
      description: '处理时间相关操作，支持时间戳生成、解析和格式化',
      category: ToolCategory.UTILITY,
      tags: ['time', 'timestamp', 'date', 'format', 'utility'],
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
      operation: z.enum(['now', 'parse', 'format', 'add', 'subtract', 'diff']).default('now'),
      input: z.string().optional(),
      format: z.enum(['timestamp', 'iso', 'local', 'utc', 'custom']).default('timestamp'),
      customFormat: z.string().optional(),
      timezone: z.string().optional(),
      amount: z.number().optional(),
      unit: z
        .enum(['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'])
        .optional(),
      compareWith: z.string().optional(),
    });
  }

  /**
   * 执行时间戳操作
   */
  protected async executeInternal(
    params: {
      operation?: string;
      input?: string;
      format?: string;
      customFormat?: string;
      timezone?: string;
      amount?: number;
      unit?: string;
      compareWith?: string;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      operation = 'now',
      input,
      format = 'timestamp',
      customFormat,
      timezone,
      amount,
      unit,
      compareWith,
    } = params;
    const startTime = Date.now();

    try {
      let date: Date;
      let resultData: any = {};

      // 处理不同的操作类型
      switch (operation) {
        case 'now':
          date = new Date();
          break;

        case 'parse':
          if (!input) {
            return {
              success: false,
              error: '解析操作需要提供 input 参数',
              metadata: { operation, executionTime: Date.now() - startTime },
            };
          }
          date = this.parseDate(input);
          if (!date || isNaN(date.getTime())) {
            return {
              success: false,
              error: `无法解析的时间格式: ${input}`,
              metadata: { operation, input, executionTime: Date.now() - startTime },
            };
          }
          break;

        case 'format':
          if (!input) {
            return {
              success: false,
              error: '格式化操作需要提供 input 参数',
              metadata: { operation, executionTime: Date.now() - startTime },
            };
          }
          date = this.parseDate(input);
          if (!date || isNaN(date.getTime())) {
            return {
              success: false,
              error: `无法解析的时间格式: ${input}`,
              metadata: { operation, input, executionTime: Date.now() - startTime },
            };
          }
          break;

        case 'add':
        case 'subtract':
          if (!input || amount === undefined || !unit) {
            return {
              success: false,
              error: `${operation} 操作需要提供 input、amount 和 unit 参数`,
              metadata: { operation, executionTime: Date.now() - startTime },
            };
          }
          date = this.parseDate(input);
          if (!date || isNaN(date.getTime())) {
            return {
              success: false,
              error: `无法解析的时间格式: ${input}`,
              metadata: { operation, input, executionTime: Date.now() - startTime },
            };
          }
          date = this.addTime(date, amount * (operation === 'subtract' ? -1 : 1), unit);
          resultData.originalDate = this.parseDate(input);
          resultData.operation = operation;
          resultData.amount = amount;
          resultData.unit = unit;
          break;

        case 'diff':
          if (!input || !compareWith) {
            return {
              success: false,
              error: 'diff 操作需要提供 input 和 compareWith 参数',
              metadata: { operation, executionTime: Date.now() - startTime },
            };
          }
          const date1 = this.parseDate(input);
          const date2 = this.parseDate(compareWith);
          if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) {
            return {
              success: false,
              error: '无法解析其中一个时间格式',
              metadata: { operation, input, compareWith, executionTime: Date.now() - startTime },
            };
          }

          const diffMs = Math.abs(date1.getTime() - date2.getTime());
          resultData = this.calculateTimeDifference(date1, date2, diffMs);
          date = date1; // 使用第一个日期作为主要结果
          break;

        default:
          return {
            success: false,
            error: `不支持的操作: ${operation}`,
            metadata: { operation, executionTime: Date.now() - startTime },
          };
      }

      // 格式化输出
      const formattedResult = this.formatDate(date, format, customFormat, timezone);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          operation,
          input: input || 'current time',
          result: formattedResult,
          formats: {
            timestamp: date.getTime(),
            iso: date.toISOString(),
            local: date.toLocaleString(),
            utc: date.toUTCString(),
            unix: Math.floor(date.getTime() / 1000),
          },
          metadata: {
            timezone: timezone || 'local',
            weekday: date.toLocaleDateString('zh-CN', { weekday: 'long' }),
            isWeekend: [0, 6].includes(date.getDay()),
            dayOfYear: this.getDayOfYear(date),
            weekOfYear: this.getWeekOfYear(date),
          },
          ...resultData,
        },
        duration: executionTime,
        metadata: {
          operation: 'timestamp',
          executionTime,
          executionId: context.executionId,
          timeConfig: {
            operation,
            format,
            timezone,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `时间处理失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'timestamp',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          timeConfig: {
            operation,
            input,
            format,
          },
        },
      };
    }
  }

  /**
   * 解析日期字符串
   */
  private parseDate(input: string): Date {
    // 尝试各种解析方式
    const timestamp = Number(input);

    // 如果是纯数字，尝试作为时间戳解析
    if (!isNaN(timestamp)) {
      // 判断是秒级还是毫秒级时间戳
      if (timestamp < 10000000000) {
        return new Date(timestamp * 1000); // 秒级时间戳
      } else {
        return new Date(timestamp); // 毫秒级时间戳
      }
    }

    // 尝试直接解析
    return new Date(input);
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date, format: string, customFormat?: string, timezone?: string): any {
    switch (format) {
      case 'timestamp':
        return date.getTime();
      case 'iso':
        return date.toISOString();
      case 'local':
        return timezone
          ? date.toLocaleString('zh-CN', { timeZone: timezone })
          : date.toLocaleString();
      case 'utc':
        return date.toUTCString();
      case 'custom':
        return customFormat ? this.applyCustomFormat(date, customFormat) : date.toISOString();
      default:
        return date.getTime();
    }
  }

  /**
   * 应用自定义格式
   */
  private applyCustomFormat(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace(/YYYY/g, String(year))
      .replace(/MM/g, month)
      .replace(/DD/g, day)
      .replace(/HH/g, hour)
      .replace(/mm/g, minute)
      .replace(/ss/g, second);
  }

  /**
   * 添加时间
   */
  private addTime(date: Date, amount: number, unit: string): Date {
    const newDate = new Date(date);

    switch (unit) {
      case 'milliseconds':
        newDate.setMilliseconds(newDate.getMilliseconds() + amount);
        break;
      case 'seconds':
        newDate.setSeconds(newDate.getSeconds() + amount);
        break;
      case 'minutes':
        newDate.setMinutes(newDate.getMinutes() + amount);
        break;
      case 'hours':
        newDate.setHours(newDate.getHours() + amount);
        break;
      case 'days':
        newDate.setDate(newDate.getDate() + amount);
        break;
      case 'weeks':
        newDate.setDate(newDate.getDate() + amount * 7);
        break;
      case 'months':
        newDate.setMonth(newDate.getMonth() + amount);
        break;
      case 'years':
        newDate.setFullYear(newDate.getFullYear() + amount);
        break;
    }

    return newDate;
  }

  /**
   * 计算时间差
   */
  private calculateTimeDifference(date1: Date, date2: Date, diffMs: number): any {
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30.44); // 平均天数
    const years = Math.floor(days / 365.25); // 平均天数

    return {
      date1: date1.toISOString(),
      date2: date2.toISOString(),
      difference: {
        milliseconds: diffMs,
        seconds,
        minutes,
        hours,
        days,
        weeks,
        months,
        years,
      },
      humanReadable: this.getHumanReadableDiff(diffMs),
      isDate1Later: date1.getTime() > date2.getTime(),
    };
  }

  /**
   * 获取人类可读的时间差
   */
  private getHumanReadableDiff(diffMs: number): string {
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} 天`;
    if (hours > 0) return `${hours} 小时`;
    if (minutes > 0) return `${minutes} 分钟`;
    return `${seconds} 秒`;
  }

  /**
   * 获取一年中的第几天
   */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * 获取一年中的第几周
   */
  private getWeekOfYear(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    );
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
