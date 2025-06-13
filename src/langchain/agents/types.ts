/**
 * LangChain Agent 类型定义
 */

import type { AgentAction, AgentFinish, AgentStep } from '@langchain/core/agents';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { BaseMessage } from '@langchain/core/messages';
import type { BladeToolkit } from '../tools/BladeToolkit.js';

/**
 * Agent 执行状态
 */
export const AgentStatus = {
  IDLE: 'idle',
  THINKING: 'thinking',
  ACTING: 'acting',
  FINISHED: 'finished',
  ERROR: 'error',
} as const;

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

/**
 * Agent 执行上下文
 */
export interface AgentContext {
  /** 执行 ID */
  executionId: string;
  /** 用户 ID */
  userId?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 时间戳 */
  timestamp: number;
  /** 工作目录 */
  workingDirectory?: string;
  /** 环境变量 */
  environment?: Record<string, string>;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 配置
 */
export interface BladeAgentConfig {
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 语言模型 */
  llm: BaseLanguageModel;
  /** 工具包 */
  toolkit: BladeToolkit;
  /** 最大思考轮数 */
  maxIterations?: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime?: number;
  /** 工具确认设置 */
  toolConfirmation?: {
    enabled: boolean;
    autoApprove?: string[];
    autoReject?: string[];
  };
  /** 记忆配置 */
  memory?: {
    enabled: boolean;
    maxMessages?: number;
    contextWindow?: number;
  };
  /** 流式输出 */
  streaming?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * Agent 思考结果
 */
export interface AgentThought {
  /** 思考内容 */
  content: string;
  /** 推理过程 */
  reasoning: string;
  /** 计划的动作 */
  plannedAction?: {
    tool: string;
    params: Record<string, any>;
    reason: string;
  };
  /** 信心度（0-1） */
  confidence: number;
  /** 思考时间（毫秒） */
  thinkingTime: number;
}

/**
 * Agent 动作
 */
export interface BladeAgentAction extends AgentAction {
  /** 工具名称 */
  tool: string;
  /** 工具输入 */
  toolInput: Record<string, any>;
  /** 动作日志 */
  log: string;
  /** 期望结果 */
  expectedResult?: string;
  /** 风险级别 */
  riskLevel?: string;
  /** 需要确认 */
  requiresConfirmation?: boolean;
}

/**
 * Agent 步骤
 */
export interface BladeAgentStep extends AgentStep {
  /** Agent 动作 */
  action: BladeAgentAction;
  /** 观察结果 */
  observation: string;
  /** 步骤状态 */
  status: 'pending' | 'executing' | 'completed' | 'failed';
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 完成结果
 */
export interface BladeAgentFinish extends AgentFinish {
  /** 返回值 */
  returnValues: Record<string, any>;
  /** 日志 */
  log: string;
  /** 完成原因 */
  reason: 'success' | 'max_iterations' | 'timeout' | 'error' | 'user_stop';
  /** 输出格式 */
  outputFormat?: 'text' | 'json' | 'markdown';
}

/**
 * Agent 执行历史
 */
export interface AgentExecutionHistory {
  /** 执行 ID */
  executionId: string;
  /** 消息历史 */
  messages: BaseMessage[];
  /** 步骤历史 */
  steps: BladeAgentStep[];
  /** 思考历史 */
  thoughts: AgentThought[];
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 最终结果 */
  result?: BladeAgentFinish;
  /** 状态 */
  status: AgentStatusType;
  /** 性能统计 */
  performance: {
    totalTime: number;
    thinkingTime: number;
    actionTime: number;
    llmCalls: number;
    toolCalls: number;
  };
}

/**
 * Agent 响应
 */
export interface AgentResponse {
  /** 执行 ID */
  executionId: string;
  /** 响应内容 */
  content: string;
  /** 响应类型 */
  type: 'thought' | 'action' | 'observation' | 'final' | 'error';
  /** 步骤信息 */
  step?: BladeAgentStep;
  /** 思考信息 */
  thought?: AgentThought;
  /** 最终结果 */
  finish?: BladeAgentFinish;
  /** 状态 */
  status: AgentStatusType;
  /** 时间戳 */
  timestamp: number;
  /** 是否为流式输出 */
  streaming?: boolean;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 事件类型
 */
export const AgentEventType = {
  EXECUTION_START: 'execution_start',
  THOUGHT_START: 'thought_start',
  THOUGHT_END: 'thought_end',
  ACTION_START: 'action_start',
  ACTION_END: 'action_end',
  TOOL_CONFIRMATION: 'tool_confirmation',
  EXECUTION_END: 'execution_end',
  ERROR: 'error',
} as const;

export type AgentEventTypeValue = (typeof AgentEventType)[keyof typeof AgentEventType];

/**
 * Agent 事件
 */
export interface AgentEvent {
  /** 事件类型 */
  type: AgentEventTypeValue;
  /** 执行 ID */
  executionId: string;
  /** 事件数据 */
  data: any;
  /** 时间戳 */
  timestamp: number;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 插件接口
 */
export interface AgentPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;

  /** 初始化插件 */
  initialize?(config: any): Promise<void>;

  /** Agent 执行前钩子 */
  beforeExecution?(context: AgentContext): Promise<void>;

  /** Agent 执行后钩子 */
  afterExecution?(context: AgentContext, result: BladeAgentFinish): Promise<void>;

  /** 思考前钩子 */
  beforeThought?(context: AgentContext, input: string): Promise<string>;

  /** 思考后钩子 */
  afterThought?(context: AgentContext, thought: AgentThought): Promise<AgentThought>;

  /** 动作前钩子 */
  beforeAction?(context: AgentContext, action: BladeAgentAction): Promise<BladeAgentAction>;

  /** 动作后钩子 */
  afterAction?(context: AgentContext, step: BladeAgentStep): Promise<BladeAgentStep>;

  /** 错误处理钩子 */
  onError?(context: AgentContext, error: Error): Promise<boolean>;
}

/**
 * 消息模式
 */
export interface MessagePattern {
  /** 模式名称 */
  name: string;
  /** 正则表达式 */
  pattern: RegExp;
  /** 处理函数 */
  handler: (match: RegExpMatchArray, context: AgentContext) => Promise<AgentResponse>;
  /** 优先级 */
  priority?: number;
}

/**
 * Agent 统计信息
 */
export interface AgentStats {
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功执行次数 */
  successfulExecutions: number;
  /** 失败执行次数 */
  failedExecutions: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 工具使用统计 */
  toolUsage: Record<string, number>;
  /** LLM 调用次数 */
  llmCalls: number;
  /** 总 token 使用量 */
  totalTokens: number;
}
