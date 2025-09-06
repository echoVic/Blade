/**
 * LLM模块导出 - 新架构
 */

import { LLMContextManager } from './LLMContextManager.js';
import { LLMManager } from './LLMManager.js';

// 核心LLM管理
export { LLMContextManager } from './LLMContextManager.js';
export type { ContextStrategy, ContextWindow, ConversationSession } from './LLMContextManager.js';

export { LLMModelRouter } from './LLMModelRouter.js';
export type { ModelDefinition, ModelPerformance, ModelSelection } from './LLMModelRouter.js';

export { ContextCompressor } from './ContextCompressor.js';
export type { CompressionResult, MessageImportance } from './ContextCompressor.js';

// 类型定义
export type {
  LLMCapability,
  LLMConfig,
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  StreamLLMResponse,
} from './types.js';

// 向后兼容 - 保留原有的LLM类
export { BaseLLM } from './BaseLLM.js';
export { LLMManager } from './LLMManager.js';

// 创建LLM上下文管理器的便捷函数
export async function createLLMContextManager(config: any): Promise<LLMContextManager> {
  const manager = new LLMContextManager(config);
  await manager.initialize();
  return manager;
}

// 创建传统LLMManager的便捷函数（向后兼容）
export function createLLMManager(config: any): LLMManager {
  return new LLMManager(config);
}
