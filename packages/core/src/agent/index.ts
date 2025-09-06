/**
 * Agent模块导出 - 新架构
 */

import { Agent } from 'http';
import type { BladeConfig } from '../config/types/index.js';
import { MainAgent } from './MainAgent.js';

// 主要Agent类
export { MainAgent } from './MainAgent.js';
export type { AgentResponse, AgentTask, ExecutionStep, SubAgentResult } from './MainAgent.js';

// 子Agent系统
export { BaseSubAgent, SubAgentRegistry } from './SubAgentRegistry.js';
export type {
    SubAgentDefinition,
    SubAgentInstance,
    TaskRequest,
    TaskResult
} from './SubAgentRegistry.js';

// 核心组件
export { TaskPlanner } from './TaskPlanner.js';
export type { PlanningContext, TaskComplexity } from './TaskPlanner.js';

export { SteeringController } from './SteeringController.js';
export type { SteeringAdjustment, SteeringResult } from './SteeringController.js';

// 内置子Agent
export { AnalysisAgent } from './subagents/AnalysisAgent.js';
export { CodeAgent } from './subagents/CodeAgent.js';

// Agent工具
export { AgentTool } from './tools/AgentTool.js';
export type { AgentToolParams, AgentToolResult } from './tools/AgentTool.js';

// 向后兼容 - 保留原有的简单Agent
export { Agent } from './Agent.js';
export { BaseComponent } from './BaseComponent.js';
export { ComponentManager } from './ComponentManager.js';
export { ContextComponent } from './ContextComponent.js';
export { LoggerComponent } from './LoggerComponent.js';
export { MCPComponent } from './MCPComponent.js';
export { ToolComponent } from './ToolComponent.js';

// 创建Agent的便捷函数
export async function createMainAgent(config: BladeConfig): Promise<MainAgent> {
  const agent = new MainAgent(config);
  await agent.initialize();
  return agent;
}

// 创建传统Agent的便捷函数（向后兼容）
export async function createAgent(config?: any): Promise<Agent> {
  const agent = new Agent(config);
  await agent.init();
  return agent;
}
