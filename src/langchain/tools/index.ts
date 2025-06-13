/**
 * LangChain 工具集成
 */

// 基础类和类型
export { BladeTool } from './base/BladeTool.js';
export { ConvertedTool, ToolConverter } from './base/ToolConverter.js';
export * from './types.js';

// 工具包管理器
export * from './BladeToolkit.js';

// 内置工具
export * from './builtin/index.js';

// MCP 工具
export * from './mcp/index.js';

/**
 * 默认工具包实例
 */
import { BladeToolkit } from './BladeToolkit.js';

export const defaultToolkit = new BladeToolkit({
  name: 'BladeDefaultToolkit',
  description: '默认 Blade 工具包 - LangChain 集成版本',
  enableConfirmation: true,
});
