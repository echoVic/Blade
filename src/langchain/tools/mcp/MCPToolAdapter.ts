import { z } from 'zod';
import { MCPClient, MCPTool, MCPToolCall, MCPToolResult } from '../../../mcp/index.js';
import { BladeTool } from '../base/BladeTool.js';
import type { BladeToolConfig, BladeToolResult, ToolExecutionContext } from '../types.js';
import { RiskLevel, ToolCategory } from '../types.js';

/**
 * MCP 工具适配器配置
 */
export interface MCPToolAdapterConfig {
  client: MCPClient;
  sessionId: string;
  mcpTool: MCPTool;
  category?: string;
  riskLevel?: string;
  requiresConfirmation?: boolean;
}

/**
 * MCP 工具适配器
 * 将 MCP 工具转换为 Blade 工具，实现无缝集成
 */
export class MCPToolAdapter extends BladeTool {
  private client: MCPClient;
  private sessionId: string;
  private mcpTool: MCPTool;

  constructor(config: MCPToolAdapterConfig) {
    const bladeConfig: BladeToolConfig = {
      name: config.mcpTool.name,
      description: config.mcpTool.description,
      category: config.category || ToolCategory.MCP,
      tags: ['mcp', 'external'],
      version: '1.0.0',
      author: 'MCP Adapter',
      requiresConfirmation: config.requiresConfirmation ?? true,
      riskLevel: (config.riskLevel as any) || RiskLevel.MODERATE,
    };

    super(bladeConfig);

    this.client = config.client;
    this.sessionId = config.sessionId;
    this.mcpTool = config.mcpTool;
  }

  /**
   * 创建参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    try {
      // 将 MCP 工具的 JSON Schema 转换为 Zod Schema
      return this.convertJsonSchemaToZod(this.mcpTool.inputSchema);
    } catch (error) {
      // 如果转换失败，使用基础模式
      console.warn(`Failed to convert MCP tool schema for ${this.mcpTool.name}:`, error);
      return z.object({}).passthrough();
    }
  }

  /**
   * 执行 MCP 工具
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    try {
      // 检查 MCP 会话连接状态
      const session = this.client.getSession(this.sessionId);
      if (!session || !session.connected) {
        return {
          success: false,
          error: `MCP session ${this.sessionId} is not connected`,
          metadata: {
            sessionId: this.sessionId,
            toolName: this.mcpTool.name,
          },
        };
      }

      // 构建 MCP 工具调用
      const toolCall: MCPToolCall = {
        name: this.mcpTool.name,
        arguments: params,
      };

      // 执行 MCP 工具调用
      const startTime = Date.now();
      const result: MCPToolResult = await this.client.callTool(this.sessionId, toolCall);
      const executionTime = Date.now() - startTime;

      // 处理工具结果
      if (result.isError) {
        return {
          success: false,
          error: this.formatMCPResult(result),
          metadata: {
            sessionId: this.sessionId,
            toolName: this.mcpTool.name,
            executionTime,
            mcpResult: result,
          },
        };
      }

      return {
        success: true,
        data: this.formatMCPResult(result),
        metadata: {
          sessionId: this.sessionId,
          toolName: this.mcpTool.name,
          executionTime,
          mcpResult: result,
          contentTypes: result.content.map(c => c.type),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          sessionId: this.sessionId,
          toolName: this.mcpTool.name,
          originalError: error,
        },
      };
    }
  }

  /**
   * 格式化 MCP 结果为字符串
   */
  private formatMCPResult(result: MCPToolResult): string {
    if (!result.content || result.content.length === 0) {
      return '';
    }

    const formatted = result.content.map(content => {
      switch (content.type) {
        case 'text':
          return content.text || '';
        case 'image':
          return `[Image: ${content.mimeType || 'unknown'}]`;
        case 'resource':
          return `[Resource: ${content.mimeType || 'unknown'}]`;
        default:
          return `[${content.type}: ${content.mimeType || 'unknown'}]`;
      }
    });

    return formatted.join('\n');
  }

  /**
   * 将 JSON Schema 转换为 Zod Schema
   */
  private convertJsonSchemaToZod(jsonSchema: any): z.ZodSchema<any> {
    if (jsonSchema.type !== 'object') {
      return z.object({}).passthrough();
    }

    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];

    for (const [key, prop] of Object.entries(properties)) {
      const propSchema = prop as any;
      let zodType = this.convertPropertyToZod(propSchema);

      // 如果不是必需字段，设为可选
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * 将 JSON Schema 属性转换为 Zod 类型
   */
  private convertPropertyToZod(prop: any): z.ZodTypeAny {
    switch (prop.type) {
      case 'string':
        let stringSchema: z.ZodTypeAny = z.string();
        if (prop.minLength) stringSchema = stringSchema.min(prop.minLength);
        if (prop.maxLength) stringSchema = stringSchema.max(prop.maxLength);
        if (prop.pattern) stringSchema = stringSchema.regex(new RegExp(prop.pattern));
        if (prop.enum) {
          return z.enum(prop.enum as any);
        }
        return stringSchema;

      case 'number':
        let numberSchema = z.number();
        if (prop.minimum !== undefined) numberSchema = numberSchema.min(prop.minimum);
        if (prop.maximum !== undefined) numberSchema = numberSchema.max(prop.maximum);
        return numberSchema;

      case 'integer':
        let intSchema = z.number().int();
        if (prop.minimum !== undefined) intSchema = intSchema.min(prop.minimum);
        if (prop.maximum !== undefined) intSchema = intSchema.max(prop.maximum);
        return intSchema;

      case 'boolean':
        return z.boolean();

      case 'array':
        const itemSchema = prop.items ? this.convertPropertyToZod(prop.items) : z.any();
        let arraySchema = z.array(itemSchema);
        if (prop.minItems) arraySchema = arraySchema.min(prop.minItems);
        if (prop.maxItems) arraySchema = arraySchema.max(prop.maxItems);
        return arraySchema;

      case 'object':
        if (prop.properties) {
          return this.convertJsonSchemaToZod(prop);
        }
        return z.object({}).passthrough();

      default:
        return z.any();
    }
  }

  /**
   * 获取 MCP 工具信息
   */
  public getMCPTool(): MCPTool {
    return this.mcpTool;
  }

  /**
   * 获取 MCP 会话 ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 检查 MCP 连接状态
   */
  public isConnected(): boolean {
    const session = this.client.getSession(this.sessionId);
    return session?.connected || false;
  }
}
