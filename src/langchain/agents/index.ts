/**
 * LangChain Agent 模块导出
 */

// 核心 Agent 类
export { BladeAgent } from './BladeAgent.js';

// Agent 工厂和构建器
export { AgentBuilder, AgentFactory, AgentPresets } from './AgentFactory.js';

// 类型定义
export type {
  AgentContext,
  AgentEvent,
  AgentEventTypeValue,
  AgentExecutionHistory,
  AgentPlugin,
  AgentResponse,
  AgentStats,
  AgentStatusType,
  AgentThought,
  BladeAgentAction,
  BladeAgentConfig,
  BladeAgentFinish,
  BladeAgentStep,
  MessagePattern,
} from './types.js';

// 常量
export { AgentEventType, AgentStatus } from './types.js';
