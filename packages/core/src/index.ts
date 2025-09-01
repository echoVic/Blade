/**
 * Blade AI Core Export
 * 核心 AI 功能统一导出
 */

// 核心类
export { Agent } from './agent/Agent.js';
export type { BladeConfig } from '@blade-ai/types';

// 配置管理
export { ConfigManager } from './config/ConfigManager.js';
export { ConfigurationManager } from './config/ConfigurationManager.js';

// LLM 管理
export * from './llm/index.js';

// 工具系统
export * from './tools/index.js';

// 上下文管理
export * from './context/index.js';

// Agent 组件系统
export * from './agent/index.js';

// 核心业务引擎
export { BladeClient } from './core/client.js';
export { ContentGenerator } from './core/contentGenerator.js';
export { CoreToolScheduler } from './core/coreToolScheduler.js';
export { PromptManager } from './core/prompts.js';
export { SubAgent, CodeSubAgent, GitSubAgent, TestSubAgent, DocumentationSubAgent } from './core/subagent.js';

// 错误处理
export { BladeError } from './error/BladeError.js';

// 日志系统
export { Logger } from './logger/Logger.js';

// 所有类型定义
export type * from './types/index.js';