/**
 * LangChain 工具类型定义
 */

import { z } from 'zod';
import type { ToolDefinition as LegacyToolDefinition } from '../../tools/types.js';

/**
 * 工具类别枚举
 */
export const ToolCategory = {
  FILESYSTEM: 'filesystem',
  GIT: 'git',
  NETWORK: 'network',
  TEXT: 'text',
  UTILITY: 'utility',
  SMART: 'smart',
  SYSTEM: 'system',
  MCP: 'mcp',
} as const;

export type ToolCategory = (typeof ToolCategory)[keyof typeof ToolCategory];

/**
 * 风险级别枚举
 */
export const RiskLevel = {
  SAFE: 'safe',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Blade 工具配置
 */
export interface BladeToolConfig {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具分类 */
  category?: string;
  /** 工具标签 */
  tags?: string[];
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 风险级别 */
  riskLevel?: 'safe' | 'moderate' | 'high' | 'critical';
  /** 工具版本 */
  version?: string;
  /** 工具作者 */
  author?: string;
}

/**
 * Blade 工具执行结果
 */
export interface BladeToolResult {
  /** 执行是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  duration?: number;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 工具包配置
 */
export interface ToolkitConfig {
  /** 工具包名称 */
  name: string;
  /** 工具包描述 */
  description: string;
  /** 包含的工具类别 */
  categories?: ToolCategory[];
  /** 排除的工具名称 */
  excludeTools?: string[];
  /** 仅包含的工具名称 */
  includeTools?: string[];
  /** 是否启用确认功能 */
  enableConfirmation?: boolean;
  /** 默认风险级别 */
  defaultRiskLevel?: RiskLevel;
}

// ToolConverterConfig removed - not needed

/**
 * 传统工具定义（用于转换）
 */
export type LegacyTool = LegacyToolDefinition;

/**
 * Zod 模式映射
 */
export interface ZodSchemaMapping {
  [key: string]: z.ZodType<any>;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  /** 执行ID */
  executionId: string;
  /** 执行时间戳 */
  timestamp: number;
  /** 用户ID */
  userId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 工具分类 */
  category?: ToolCategory;
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 额外上下文数据 */
  context?: Record<string, any>;
}

/**
 * 批量工具操作配置
 */
export interface BatchToolConfig {
  /** 工具名称列表 */
  tools: string[];
  /** 是否并行执行 */
  parallel?: boolean;
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 失败时是否继续 */
  continueOnError?: boolean;
  /** 总超时时间 */
  totalTimeout?: number;
}

/**
 * 工具性能指标
 */
export interface ToolMetrics {
  /** 执行次数 */
  executionCount: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 成功率 */
  successRate: number;
  /** 最后执行时间 */
  lastExecutionTime: Date;
  /** 错误计数 */
  errorCount: number;
}

/**
 * 工具注册选项
 */
export interface ToolRegistrationOptions {
  /** 是否覆盖已存在的工具 */
  override?: boolean;
  /** 工具启用状态 */
  enabled?: boolean;
  /** 工具权限配置 */
  permissions?: string[];
  /** 自定义配置 */
  config?: BladeToolConfig;
  /** 是否自动注册 */
  autoRegister?: boolean;
}
