/**
 * Blade 工具包管理器
 *
 * 提供统一的工具注册、管理和调用接口
 */

import { Tool } from '@langchain/core/tools';
import { BladeTool } from './base/BladeTool.js';
import { ConvertedTool, ToolConverter } from './base/ToolConverter.js';
import type {
  BatchToolConfig,
  LegacyTool,
  ToolCategory,
  ToolkitConfig,
  ToolMetrics,
  ToolRegistrationOptions,
} from './types.js';
import { RiskLevel } from './types.js';

/**
 * Blade 工具包主类
 *
 * 核心功能：
 * - 工具注册与管理
 * - 传统工具转换
 * - 批量操作支持
 * - 性能监控
 * - 风险管理
 */
export class BladeToolkit {
  private tools: Map<string, BladeTool> = new Map();
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private config: ToolkitConfig;

  constructor(config: Partial<ToolkitConfig> = {}) {
    this.config = {
      name: 'BladeToolkit',
      description: 'Blade AI 工具包 - LangChain 集成版本',
      enableConfirmation: true,
      defaultRiskLevel: RiskLevel.MODERATE,
      ...config,
    };
  }

  /**
   * 注册单个工具
   */
  public registerTool(tool: BladeTool, options: ToolRegistrationOptions = {}): void {
    const { override = false, enabled = true } = options;

    if (this.tools.has(tool.name) && !override) {
      throw new Error(`Tool ${tool.name} already exists. Use override: true to replace.`);
    }

    if (enabled) {
      this.tools.set(tool.name, tool);
      this.initializeToolMetrics(tool.name);
      console.log(`✅ 已注册工具: ${tool.name} (${tool.category})`);
    }
  }

  /**
   * 批量注册工具
   */
  public registerTools(tools: BladeTool[], options: ToolRegistrationOptions = {}): void {
    for (const tool of tools) {
      try {
        this.registerTool(tool, options);
      } catch (error) {
        console.error(`❌ 注册工具失败 ${tool.name}:`, error);
        if (!options.override) {
          throw error;
        }
      }
    }
  }

  /**
   * 从传统工具转换并注册
   */
  public registerLegacyTool(
    legacyTool: LegacyTool,
    options: ToolRegistrationOptions = {}
  ): ConvertedTool {
    const convertedTool = ToolConverter.convertTool(legacyTool);
    this.registerTool(convertedTool, options);
    return convertedTool;
  }

  /**
   * 批量转换并注册传统工具
   */
  public registerLegacyTools(
    legacyTools: LegacyTool[],
    options: ToolRegistrationOptions = {}
  ): ConvertedTool[] {
    const convertedTools = ToolConverter.convertTools(legacyTools);

    convertedTools.forEach(tool => {
      try {
        this.registerTool(tool, options);
      } catch (error) {
        console.error(`❌ 注册转换工具失败 ${tool.name}:`, error);
      }
    });

    return convertedTools;
  }

  /**
   * 获取工具
   */
  public getTool(name: string): BladeTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  public getAllTools(): BladeTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按分类获取工具
   */
  public getToolsByCategory(category: ToolCategory): BladeTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * 按风险级别获取工具
   */
  public getToolsByRiskLevel(riskLevel: RiskLevel): BladeTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.getRiskLevel() === riskLevel);
  }

  /**
   * 搜索工具
   */
  public searchTools(query: string): BladeTool[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.tools.values()).filter(
      tool =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 获取需要确认的工具
   */
  public getConfirmationRequiredTools(): BladeTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.needsConfirmation());
  }

  /**
   * 转换为 LangChain Tools 数组
   */
  public toLangChainTools(): Tool[] {
    const tools = Array.from(this.tools.values());

    // 应用工具包配置过滤
    let filteredTools = tools;

    if (this.config.categories) {
      filteredTools = filteredTools.filter(tool => this.config.categories!.includes(tool.category));
    }

    if (this.config.excludeTools) {
      filteredTools = filteredTools.filter(tool => !this.config.excludeTools!.includes(tool.name));
    }

    if (this.config.includeTools) {
      filteredTools = filteredTools.filter(tool => this.config.includeTools!.includes(tool.name));
    }

    return filteredTools as Tool[];
  }

  /**
   * 执行工具
   */
  public async executeTool(
    toolName: string,
    params: string | Record<string, any>
  ): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const startTime = Date.now();
    let result: string;
    let success = true;

    try {
      const inputString = typeof params === 'string' ? params : JSON.stringify(params);
      result = await tool._call(inputString);
    } catch (error) {
      success = false;
      result = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
      throw error;
    } finally {
      this.updateToolMetrics(toolName, Date.now() - startTime, success);
    }

    return result;
  }

  /**
   * 批量执行工具
   */
  public async executeToolsBatch(batchConfig: BatchToolConfig): Promise<Record<string, any>> {
    const { tools, parallel = false, maxConcurrency = 3, continueOnError = true } = batchConfig;
    const results: Record<string, any> = {};

    if (parallel) {
      // 并行执行（带并发限制）
      const chunks = this.chunkArray(tools, maxConcurrency);

      for (const chunk of chunks) {
        const promises = chunk.map(async toolName => {
          try {
            const result = await this.executeTool(toolName, {});
            return { toolName, result, success: true, error: undefined };
          } catch (error) {
            const errorResult = {
              toolName,
              error: error instanceof Error ? error.message : String(error),
              success: false,
              result: undefined,
            };

            if (!continueOnError) {
              throw error;
            }

            return errorResult;
          }
        });

        const chunkResults = await Promise.all(promises);
        chunkResults.forEach(({ toolName, result, success, error }) => {
          results[toolName] = success ? result : { error };
        });
      }
    } else {
      // 顺序执行
      for (const toolName of tools) {
        try {
          results[toolName] = await this.executeTool(toolName, {});
        } catch (error) {
          results[toolName] = {
            error: error instanceof Error ? error.message : String(error),
          };

          if (!continueOnError) {
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * 获取工具统计信息
   */
  public getToolMetrics(toolName?: string): ToolMetrics | Record<string, ToolMetrics> {
    if (toolName) {
      return this.toolMetrics.get(toolName) || this.createEmptyMetrics();
    }

    return Object.fromEntries(this.toolMetrics.entries());
  }

  /**
   * 获取工具包统计
   */
  public getToolkitStats(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    toolsByRiskLevel: Record<string, number>;
    totalExecutions: number;
    averageExecutionTime: number;
  } {
    const tools = Array.from(this.tools.values());
    const metrics = Array.from(this.toolMetrics.values());

    const toolsByCategory: Record<string, number> = {};
    const toolsByRiskLevel: Record<string, number> = {};

    tools.forEach(tool => {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
      toolsByRiskLevel[tool.getRiskLevel()] = (toolsByRiskLevel[tool.getRiskLevel()] || 0) + 1;
    });

    const totalExecutions = metrics.reduce((sum, metric) => sum + metric.executionCount, 0);
    const totalTime = metrics.reduce(
      (sum, metric) => sum + metric.averageExecutionTime * metric.executionCount,
      0
    );
    const averageExecutionTime = totalExecutions > 0 ? totalTime / totalExecutions : 0;

    return {
      totalTools: tools.length,
      toolsByCategory,
      toolsByRiskLevel,
      totalExecutions,
      averageExecutionTime,
    };
  }

  /**
   * 移除工具
   */
  public removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      this.toolMetrics.delete(toolName);
      console.log(`🗑️  已移除工具: ${toolName}`);
    }
    return removed;
  }

  /**
   * 清空所有工具
   */
  public clear(): void {
    this.tools.clear();
    this.toolMetrics.clear();
    console.log('🧹 已清空所有工具');
  }

  /**
   * 获取工具列表信息
   */
  public listTools(): string {
    const tools = Array.from(this.tools.values());

    if (tools.length === 0) {
      return '📭 暂无已注册的工具';
    }

    const categories = new Map<string, BladeTool[]>();
    tools.forEach(tool => {
      const category = tool.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(tool);
    });

    let output = `📋 Blade 工具包 (${tools.length} 个工具)\n\n`;

    categories.forEach((categoryTools, category) => {
      output += `## ${category} (${categoryTools.length})\n`;
      categoryTools.forEach(tool => {
        const riskIcon = this.getRiskIcon(tool.getRiskLevel());
        const confirmIcon = tool.needsConfirmation() ? '⚠️' : '✅';

        output += `  ${riskIcon} ${confirmIcon} ${tool.name} - ${tool.description}\n`;
      });
      output += '\n';
    });

    return output;
  }

  /**
   * 私有辅助方法
   */
  private initializeToolMetrics(toolName: string): void {
    this.toolMetrics.set(toolName, this.createEmptyMetrics());
  }

  private createEmptyMetrics(): ToolMetrics {
    return {
      executionCount: 0,
      averageExecutionTime: 0,
      successRate: 1,
      lastExecutionTime: new Date(),
      errorCount: 0,
    };
  }

  private updateToolMetrics(toolName: string, executionTime: number, success: boolean): void {
    const metrics = this.toolMetrics.get(toolName);
    if (!metrics) return;

    metrics.executionCount++;
    metrics.averageExecutionTime =
      (metrics.averageExecutionTime * (metrics.executionCount - 1) + executionTime) /
      metrics.executionCount;

    if (!success) {
      metrics.errorCount++;
    }

    metrics.successRate = (metrics.executionCount - metrics.errorCount) / metrics.executionCount;
    metrics.lastExecutionTime = new Date();
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getRiskIcon(riskLevel: RiskLevel): string {
    const icons: Record<RiskLevel, string> = {
      [RiskLevel.SAFE]: '🟢',
      [RiskLevel.MODERATE]: '🟡',
      [RiskLevel.HIGH]: '🟠',
      [RiskLevel.CRITICAL]: '🔴',
    };
    return icons[riskLevel] || '⚪';
  }

  /**
   * 检查工具是否存在
   */
  public hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}
