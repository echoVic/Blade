/**
 * Blade 工具基类 - LangChain 集成
 */

import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BladeToolConfig, BladeToolResult, ToolExecutionContext } from '../types.js';
import { RiskLevel, ToolCategory } from '../types.js';

/**
 * Blade 工具基类
 *
 * 继承 LangChain Tool，提供：
 * - 统一的工具接口
 * - 错误处理和重试机制
 * - 执行时间统计
 * - 参数验证
 * - 确认机制支持
 */
export abstract class BladeTool extends Tool {
  /** 工具配置 */
  protected config: BladeToolConfig;

  /** 工具分类 */
  public readonly category: ToolCategory;

  /** 工具标签 */
  public readonly tags: string[];

  /** 是否需要确认 */
  public readonly requiresConfirmation: boolean;

  /** 风险级别 */
  public readonly riskLevel: RiskLevel;

  /** 工具版本 */
  public readonly version: string;

  /** 工具名称 */
  public readonly name: string;

  /** 工具描述 */
  public readonly description: string;

  constructor(config: BladeToolConfig) {
    super();

    this.config = {
      requiresConfirmation: false,
      riskLevel: 'safe',
      version: '1.0.0',
      ...config,
    };

    // 设置工具基本信息
    this.name = this.config.name;
    this.description = this.config.description;
    this.category = (this.config.category as ToolCategory) || ToolCategory.UTILITY;
    this.tags = this.config.tags || [];
    this.requiresConfirmation = this.config.requiresConfirmation || false;
    this.riskLevel = (this.config.riskLevel as RiskLevel) || RiskLevel.SAFE;
    this.version = this.config.version || '1.0.0';
  }

  /**
   * 直接执行方法
   * 提供类型安全的参数接口
   */
  async execute(
    params: Record<string, any>,
    context?: Partial<ToolExecutionContext>
  ): Promise<BladeToolResult> {
    const startTime = Date.now();
    let executionId: string;

    try {
      // 生成执行ID
      executionId = this.generateExecutionId();

      // 验证参数
      const validatedParams = await this.validateAndParseParameters(params);

      // 创建执行上下文
      const fullContext: ToolExecutionContext = {
        executionId,
        timestamp: startTime,
        category: this.category,
        requiresConfirmation: this.requiresConfirmation,
        ...context,
      };

      // 执行工具逻辑
      const result = await this.executeInternal(validatedParams, fullContext);

      // 计算执行时间
      const duration = Date.now() - startTime;
      result.duration = duration;

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        metadata: {
          executionId: executionId!,
          toolName: this.name,
        },
      };
    }
  }

  /**
   * LangChain 工具执行方法
   * 包装我们的 executeInternal 方法
   */
  async _call(arg: string): Promise<string> {
    try {
      // 解析参数
      const params = this.parseArguments(arg);

      // 执行工具
      const result = await this.execute(params);

      // 返回结果
      if (result.success) {
        return this.formatSuccessResult(result);
      } else {
        return this.formatErrorResult(result);
      }
    } catch (error) {
      const errorResult: BladeToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        metadata: {
          toolName: this.name,
        },
      };

      return this.formatErrorResult(errorResult);
    }
  }

  /**
   * 抽象方法：内部执行逻辑
   * 子类需要实现此方法
   */
  protected abstract executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult>;

  /**
   * 创建参数验证模式
   * 子类需要实现此方法
   */
  protected abstract createSchema(): z.ZodSchema<any>;

  /**
   * 验证和解析参数
   */
  protected async validateAndParseParameters(
    params: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const schema = this.createSchema();
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new Error(`参数验证失败: ${issues.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 解析参数
   * 支持 JSON 字符串和对象
   */
  protected parseArguments(arg: string): Record<string, any> {
    try {
      // 尝试解析为 JSON
      return JSON.parse(arg);
    } catch {
      // 如果不是 JSON，创建简单的键值对象
      return { input: arg };
    }
  }

  /**
   * 验证参数
   * 子类可以重写此方法进行自定义验证
   */
  protected async validateParameters(params: Record<string, any>): Promise<void> {
    // 基础验证逻辑
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid parameters: must be an object');
    }
  }

  /**
   * 生成执行ID
   */
  protected generateExecutionId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 格式化成功结果
   */
  protected formatSuccessResult(result: BladeToolResult): string {
    if (typeof result.data === 'string') {
      return result.data;
    }

    if (result.data) {
      return JSON.stringify(result.data, null, 2);
    }

    return '操作成功完成';
  }

  /**
   * 格式化错误结果
   */
  protected formatErrorResult(result: BladeToolResult): string {
    const errorInfo = {
      success: false,
      error: result.error,
      duration: result.duration,
      metadata: result.metadata,
    };

    return JSON.stringify(errorInfo, null, 2);
  }

  /**
   * 获取工具元数据
   */
  public getMetadata(): BladeToolConfig {
    return { ...this.config };
  }

  /**
   * 检查工具是否支持某个功能
   */
  public supportsFeature(feature: string): boolean {
    return this.tags.includes(feature);
  }

  /**
   * 获取风险级别
   */
  public getRiskLevel(): RiskLevel {
    return this.riskLevel;
  }

  /**
   * 检查是否需要确认
   */
  public needsConfirmation(): boolean {
    return this.requiresConfirmation;
  }

  /**
   * 获取工具示例
   */
  public getExamples(): string[] {
    return [];
  }

  /**
   * 获取工具帮助信息
   */
  public getHelp(): string {
    return `${this.name}: ${this.description}`;
  }
}
