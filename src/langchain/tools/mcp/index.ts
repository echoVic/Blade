/**
 * MCP 工具集成模块
 * Model Context Protocol 与 Blade 工具系统的集成
 */

// MCP 工具适配器
export { MCPToolAdapter, type MCPToolAdapterConfig } from './MCPToolAdapter.js';

// MCP 工具管理器
export {
  MCPToolManager,
  type MCPManagerStats,
  type MCPServerConfig,
  type MCPToolDiscoveryConfig,
} from './MCPToolManager.js';

// 便捷函数 - 使用导入的类型
import { MCPToolAdapter, MCPToolAdapterConfig } from './MCPToolAdapter.js';
import { MCPToolDiscoveryConfig, MCPToolManager } from './MCPToolManager.js';

export async function createMCPToolManager(
  config?: MCPToolDiscoveryConfig
): Promise<MCPToolManager> {
  return new MCPToolManager(config);
}

export async function createMCPAdapter(
  client: any,
  sessionId: string,
  mcpTool: any,
  options?: Partial<MCPToolAdapterConfig>
): Promise<MCPToolAdapter> {
  return new MCPToolAdapter({
    client,
    sessionId,
    mcpTool,
    ...options,
  });
}
