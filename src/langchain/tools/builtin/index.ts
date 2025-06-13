/**
 * LangChain 内置工具导出
 */

// 文件系统工具
export { FileReadTool } from './FileReadTool.js';
export { FileWriteTool } from './FileWriteTool.js';

// TODO: 将现有工具逐步转换为 LangChain 工具
// export { DirectoryListTool } from './DirectoryListTool.js';
// export { FileInfoTool } from './FileInfoTool.js';

// Git 工具
// export { GitStatusTool } from './GitStatusTool.js';
// export { GitAddTool } from './GitAddTool.js';
// export { GitCommitTool } from './GitCommitTool.js';

// 网络工具
export { HttpRequestTool } from './HttpRequestTool.js';

// 文本处理工具
// export { TextLengthTool } from './TextLengthTool.js';
// export { TextFormatTool } from './TextFormatTool.js';
// export { TextSearchTool } from './TextSearchTool.js';
// export { TextReplaceTool } from './TextReplaceTool.js';

// 实用工具
export { TimestampTool } from './TimestampTool.js';

/**
 * 获取所有内置工具
 */
import { FileReadTool } from './FileReadTool.js';
import { FileWriteTool } from './FileWriteTool.js';
import { HttpRequestTool } from './HttpRequestTool.js';
import { TimestampTool } from './TimestampTool.js';

export function getAllBuiltinTools() {
  return [new FileReadTool(), new FileWriteTool(), new HttpRequestTool(), new TimestampTool()];
}

/**
 * 按分类获取工具
 */
export function getToolsByCategory(category: string) {
  const allTools = getAllBuiltinTools();

  return allTools.filter(tool => tool.category === category);
}

/**
 * 获取文件系统工具
 */
export function getFileSystemTools() {
  return [new FileReadTool(), new FileWriteTool()];
}

/**
 * 获取网络工具
 */
export function getNetworkTools() {
  return [new HttpRequestTool()];
}

/**
 * 获取实用工具
 */
export function getUtilityTools() {
  return [new TimestampTool()];
}
