/**
 * Blade AI 内置工具集合
 * 重构后的高性能、类型安全工具实现
 */

// 导入所有工具类
import { Base64Tool } from './Base64Tool.js';
import { DirectoryListTool } from './DirectoryListTool.js';
import { FileInfoTool } from './FileInfoTool.js';
import { FileReadTool } from './FileReadTool.js';
import { FileWriteTool } from './FileWriteTool.js';
import { GitAddTool } from './GitAddTool.js';
import { GitStatusTool } from './GitStatusTool.js';
import { HttpGetTool } from './HttpGetTool.js';
import { HttpPostTool } from './HttpPostTool.js';
import { JsonFormatTool } from './JsonFormatTool.js';
import { RandomTool } from './RandomTool.js';
import { TextReplaceTool } from './TextReplaceTool.js';
import { TextSearchTool } from './TextSearchTool.js';
import { TimestampTool } from './TimestampTool.js';
import { UrlParseTool } from './UrlParseTool.js';
import { UuidTool } from './UuidTool.js';

// 重新导出工具类
export {
  Base64Tool,
  DirectoryListTool,
  FileInfoTool,
  FileReadTool,
  FileWriteTool,
  GitAddTool,
  GitStatusTool,
  HttpGetTool,
  HttpPostTool,
  JsonFormatTool,
  RandomTool,
  TextReplaceTool,
  TextSearchTool,
  TimestampTool,
  UrlParseTool,
  UuidTool,
};

// 工具实例导出（用于快速注册）
export const builtinTools = [
  FileReadTool,
  FileWriteTool,
  DirectoryListTool,
  FileInfoTool,
  HttpGetTool,
  HttpPostTool,
  UrlParseTool,
  JsonFormatTool,
  TextSearchTool,
  TextReplaceTool,
  GitStatusTool,
  GitAddTool,
  TimestampTool,
  UuidTool,
  Base64Tool,
  RandomTool,
];

// 按类别分组的工具
export const toolsByCategory = {
  filesystem: [FileReadTool, FileWriteTool, DirectoryListTool, FileInfoTool],
  network: [HttpGetTool, HttpPostTool, UrlParseTool],
  text: [TextSearchTool, TextReplaceTool, JsonFormatTool],
  git: [GitStatusTool, GitAddTool],
  utility: [TimestampTool, UuidTool, Base64Tool, RandomTool],
};

// 工具元数据
export const toolMetadata = {
  version: '2.0.0',
  totalTools: builtinTools.length,
  categories: Object.keys(toolsByCategory),
  description: 'Blade AI 重构后的内置工具集合，提供高性能、类型安全的工具实现',
  completionStatus: {
    implemented: builtinTools.length,
    originalTotal: 23,
    completionRate: `${Math.round((builtinTools.length / 23) * 100)}%`,
  },
};

/**
 * 获取所有内置工具实例
 */
export function getAllBuiltinTools() {
  return [
    new FileReadTool(),
    new FileWriteTool(),
    new DirectoryListTool(),
    new FileInfoTool(),
    new HttpGetTool(),
    new HttpPostTool(),
    new UrlParseTool(),
    new JsonFormatTool(),
    new TextSearchTool(),
    new TextReplaceTool(),
    new GitStatusTool(),
    new GitAddTool(),
    new TimestampTool(),
    new UuidTool(),
    new Base64Tool(),
    new RandomTool(),
  ];
}

/**
 * 按分类获取工具实例
 */
export function getToolsByCategory(category: string) {
  const allTools = getAllBuiltinTools();
  return allTools.filter(tool => tool.category === category);
}

/**
 * 获取文件系统工具实例
 */
export function getFileSystemTools() {
  return [new FileReadTool(), new FileWriteTool(), new DirectoryListTool(), new FileInfoTool()];
}

/**
 * 获取网络工具实例
 */
export function getNetworkTools() {
  return [new HttpGetTool(), new HttpPostTool(), new UrlParseTool()];
}

/**
 * 获取文本处理工具实例
 */
export function getTextProcessingTools() {
  return [new TextSearchTool(), new TextReplaceTool(), new JsonFormatTool()];
}

/**
 * 获取Git工具实例
 */
export function getGitTools() {
  return [new GitStatusTool(), new GitAddTool()];
}

/**
 * 获取实用工具实例
 */
export function getUtilityTools() {
  return [new TimestampTool(), new UuidTool(), new Base64Tool(), new RandomTool()];
}
