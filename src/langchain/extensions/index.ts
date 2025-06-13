/**
 * LangChain 扩展系统
 * Blade AI 的扩展和 MCP 集成模块
 */

// 核心扩展系统
export { ExtensionManager, type ExtensionManagerConfig } from './ExtensionManager.js';

// 扩展类型定义
export type {
  Extension,
  ExtensionAPI,
  ExtensionConfig,
  ExtensionContext,
  ExtensionDependencyResult,
  ExtensionDescriptor,
  ExtensionEventEmitter,
  ExtensionHooks,
  ExtensionInstallOptions,
  ExtensionLogger,
  ExtensionManagerEventValue,
  ExtensionMarketplace,
  ExtensionMetadata,
  ExtensionSearchOptions,
  ExtensionStats,
  ExtensionStatusValue,
  ExtensionStorage,
  ExtensionTypeValue,
  ExtensionUpdateInfo,
} from './types.js';

// 扩展常量
export { ExtensionManagerEvent, ExtensionStatus, ExtensionType } from './types.js';

// MCP 工具集成
export { MCPToolAdapter, type MCPToolAdapterConfig } from '../tools/mcp/MCPToolAdapter.js';
export {
  MCPToolManager,
  type MCPManagerStats,
  type MCPServerConfig,
  type MCPToolDiscoveryConfig,
} from '../tools/mcp/MCPToolManager.js';
