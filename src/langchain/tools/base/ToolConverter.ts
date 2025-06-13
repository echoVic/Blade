/**
 * 工具转换器 - 将传统工具转换为 LangChain 工具
 */

import type {
  BladeToolConfig,
  BladeToolResult,
  LegacyTool,
  ToolConverterConfig,
  ToolExecutionContext,
} from '../types.js';
import { BladeTool } from './BladeTool.js';

/**
 * 转换后的 LangChain 工具
 */
export class ConvertedTool extends BladeTool {
  private legacyTool: LegacyTool;
  private converterConfig: ToolConverterConfig;

  constructor(legacyTool: LegacyTool, converterConfig: ToolConverterConfig = {}) {
    // 转换配置为 BladeToolConfig
    const bladeConfig: BladeToolConfig = ToolConverter.convertConfig(legacyTool);

    super(bladeConfig);

    this.legacyTool = legacyTool;
    this.converterConfig = {
      preserveParameters: true,
      addErrorHandling: true,
      enableValidation: true,
      ...converterConfig,
    };
  }

  /**
   * 执行转换后的工具
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    try {
      // 转换参数格式
      const convertedParams = this.convertParameters(params);

      // 执行传统工具
      const legacyResult = await this.legacyTool.execute(convertedParams);

      // 转换结果格式
      return this.convertResult(legacyResult, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          toolName: this.name,
          executionId: context.executionId,
          originalError: error,
        },
      };
    }
  }

  /**
   * 转换参数格式
   */
  private convertParameters(params: Record<string, any>): Record<string, any> {
    if (!this.converterConfig.preserveParameters) {
      return params;
    }

    // 应用参数映射
    if (this.converterConfig.parameterMapping) {
      const mappedParams: Record<string, any> = {};

      Object.entries(params).forEach(([key, value]) => {
        const mappedKey = this.converterConfig.parameterMapping![key] || key;
        mappedParams[mappedKey] = value;
      });

      return mappedParams;
    }

    return params;
  }

  /**
   * 转换结果格式
   */
  private convertResult(legacyResult: any, context: ToolExecutionContext): BladeToolResult {
    // 如果已经是标准格式
    if (legacyResult && typeof legacyResult === 'object' && 'success' in legacyResult) {
      return {
        ...legacyResult,
        metadata: {
          ...legacyResult.metadata,
          executionId: context.executionId,
          category: this.category,
        },
      };
    }

    // 转换为标准格式
    return {
      success: true,
      data: legacyResult,
      metadata: {
        executionId: context.executionId,
        category: this.category,
        toolName: this.name,
      },
    };
  }

  /**
   * 获取原始工具定义
   */
  public getLegacyTool(): LegacyTool {
    return this.legacyTool;
  }
}

/**
 * 工具转换器主类
 */
export class ToolConverter {
  /**
   * 转换单个工具
   */
  static convertTool(legacyTool: LegacyTool, config: ToolConverterConfig = {}): ConvertedTool {
    return new ConvertedTool(legacyTool, config);
  }

  /**
   * 批量转换工具
   */
  static convertTools(
    legacyTools: LegacyTool[],
    config: ToolConverterConfig = {}
  ): ConvertedTool[] {
    return legacyTools.map(tool => ToolConverter.convertTool(tool, config));
  }

  /**
   * 转换工具配置
   */
  static convertConfig(legacyTool: LegacyTool): BladeToolConfig {
    return {
      name: legacyTool.name,
      description: legacyTool.description,
      category: legacyTool.category,
      tags: legacyTool.tags,
      version: legacyTool.version,
      author: legacyTool.author,
      requiresConfirmation: ToolConverter.determineConfirmationNeed(legacyTool),
      riskLevel: ToolConverter.determineRiskLevel(legacyTool),
    };
  }

  /**
   * 确定是否需要确认
   */
  private static determineConfirmationNeed(legacyTool: LegacyTool): boolean {
    const dangerousOperations = [
      'file_write',
      'file_delete',
      'directory_create',
      'directory_delete',
      'git_commit',
      'git_push',
      'git_reset',
      'git_rebase',
      'command_execution',
      'system_command',
    ];

    const dangerousCategories = ['filesystem', 'git', 'system'];

    return (
      dangerousOperations.includes(legacyTool.name) ||
      dangerousCategories.includes(legacyTool.category || '')
    );
  }

  /**
   * 确定风险级别
   */
  private static determineRiskLevel(legacyTool: LegacyTool): 'safe' | 'moderate' | 'high' | 'critical' {
    const criticalOperations = [
      'file_delete', 'directory_delete', 'git_reset', 'git_force_push',
      'system_shutdown', 'process_kill'
    ];
    
    const highRiskOperations = [
      'file_write', 'git_commit', 'git_push', 'command_execution'
    ];
    
    const moderateRiskOperations = [
      'file_read', 'directory_create', 'git_add', 'git_status'
    ];

    if (criticalOperations.includes(legacyTool.name)) {
      return 'critical';
    }
    
    if (highRiskOperations.includes(legacyTool.name)) {
      return 'high';
    }
    
    if (moderateRiskOperations.includes(legacyTool.name)) {
      return 'moderate';
    }
    
    return 'safe';
  }
}
