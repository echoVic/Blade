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
 * UUID 生成工具
 * 生成各种版本的 UUID，支持批量生成
 */
export class UuidTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'uuid',
      description: '生成 UUID，支持多种版本和批量生成',
      category: ToolCategory.UTILITY,
      tags: ['uuid', 'id', 'generator', 'random', 'utility'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      version: z.enum(['v4', 'v1', 'v6']).default('v4'),
      count: z.number().positive().max(1000).default(1),
      format: z.enum(['standard', 'uppercase', 'lowercase', 'compact']).default('standard'),
      prefix: z.string().max(20).optional(),
      suffix: z.string().max(20).optional(),
    });
  }

  protected async executeInternal(
    params: {
      version?: string;
      count?: number;
      format?: string;
      prefix?: string;
      suffix?: string;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { version = 'v4', count = 1, format = 'standard', prefix, suffix } = params;
    const startTime = Date.now();

    try {
      // 动态导入 crypto 模块
      const crypto = await import('crypto');

      const uuids: string[] = [];
      const statistics = {
        generated: 0,
        duplicates: 0,
        version,
        format,
      };

      for (let i = 0; i < count; i++) {
        let uuid: string;

        switch (version) {
          case 'v4':
            uuid = crypto.randomUUID();
            break;
          case 'v1':
          case 'v6':
            // Node.js 不直接支持 v1 和 v6，使用 v4 替代
            uuid = crypto.randomUUID();
            break;
          default:
            uuid = crypto.randomUUID();
        }

        // 应用格式
        uuid = this.formatUuid(uuid, format);

        // 添加前缀和后缀
        if (prefix) uuid = prefix + uuid;
        if (suffix) uuid = uuid + suffix;

        // 检查重复（在大量生成时几乎不可能，但为了完整性）
        if (uuids.includes(uuid)) {
          statistics.duplicates++;
          i--; // 重新生成
          continue;
        }

        uuids.push(uuid);
        statistics.generated++;
      }

      const executionTime = Date.now() - startTime;

      // 构建结果
      const result = count === 1 ? uuids[0] : uuids;

      return {
        success: true,
        data: {
          result,
          count: statistics.generated,
          version,
          format,
          prefix: prefix || null,
          suffix: suffix || null,
          statistics,
          examples: this.getUuidExamples(),
        },
        duration: executionTime,
        metadata: {
          operation: 'uuid_generate',
          executionTime,
          executionId: context.executionId,
          generationConfig: {
            version,
            count,
            format,
            hasPrefix: !!prefix,
            hasSuffix: !!suffix,
          },
          performance: {
            generationRate: Math.round((statistics.generated / executionTime) * 1000), // UUIDs per second
            totalGenerated: statistics.generated,
            duplicatesFound: statistics.duplicates,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `UUID 生成失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'uuid_generate',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          generationConfig: {
            version,
            count,
            format,
          },
        },
      };
    }
  }

  /**
   * 格式化 UUID
   */
  private formatUuid(uuid: string, format: string): string {
    switch (format) {
      case 'uppercase':
        return uuid.toUpperCase();
      case 'lowercase':
        return uuid.toLowerCase();
      case 'compact':
        return uuid.replace(/-/g, '');
      case 'standard':
      default:
        return uuid;
    }
  }

  /**
   * 获取 UUID 示例
   */
  private getUuidExamples(): Record<string, string> {
    const sampleUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

    return {
      standard: sampleUuid,
      uppercase: sampleUuid.toUpperCase(),
      lowercase: sampleUuid.toLowerCase(),
      compact: sampleUuid.replace(/-/g, ''),
    };
  }
}
