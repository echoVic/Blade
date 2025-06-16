/**
 * LangChain 官方工具集合
 * 使用 LangChain 原生工具，避免重复造轮子
 */

import { Tool } from '@langchain/core/tools';
import { DynamicTool } from 'langchain/tools';

/**
 * 使用 DynamicTool 创建文件读取工具
 * 模拟 LangChain 社区的文件工具
 */
function createReadFileTool(): Tool {
  return new DynamicTool({
    name: 'read_file',
    description: 'Read the contents of a file',
    func: async (input: string) => {
      console.log(`🔧 [read_file] 工具被调用，参数: ${input}`);
      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        // 解析文件路径
        const resolvedPath = path.resolve(input.trim());
        console.log(`🔧 [read_file] 解析路径: ${resolvedPath}`);

        // 检查文件是否存在
        const stats = await fs.stat(resolvedPath);
        console.log(`🔧 [read_file] 文件存在，大小: ${stats.size} 字节`);

        // 读取文件内容
        const content = await fs.readFile(resolvedPath, 'utf-8');
        console.log(`🔧 [read_file] 成功读取文件，内容长度: ${content.length} 字符`);
        console.log(`🔧 [read_file] 文件内容预览: ${content.substring(0, 200)}...`);

        return content;
      } catch (error) {
        const errorMsg = `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`🔧 [read_file] 错误: ${errorMsg}`);
        return errorMsg;
      }
    },
  });
}

/**
 * 使用 DynamicTool 创建文件写入工具
 */
function createWriteFileTool(): Tool {
  return new DynamicTool({
    name: 'write_file',
    description: 'Write content to a file. Input format: file_path,content',
    func: async (input: string) => {
      try {
        const [filePath, ...contentParts] = input.split(',');
        const content = contentParts.join(',');
        const fs = await import('fs/promises');
        await fs.writeFile(filePath.trim(), content.trim(), 'utf-8');
        return `File written successfully: ${filePath.trim()}`;
      } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 使用 DynamicTool 创建 HTTP GET 工具
 */
function createHttpGetTool(): Tool {
  return new DynamicTool({
    name: 'http_get',
    description: 'Make HTTP GET request to a URL',
    func: async (url: string) => {
      try {
        const response = await fetch(url);
        const text = await response.text();
        return text;
      } catch (error) {
        return `Error making request: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 使用 DynamicTool 创建 HTTP POST 工具
 */
function createHttpPostTool(): Tool {
  return new DynamicTool({
    name: 'http_post',
    description: 'Make HTTP POST request. Input format: url,json_data',
    func: async (input: string) => {
      try {
        const [url, jsonData] = input.split(',', 2);
        const response = await fetch(url.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonData.trim(),
        });
        const text = await response.text();
        return text;
      } catch (error) {
        return `Error making request: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 使用 DynamicTool 创建 JSON 处理工具
 */
function createJsonTool(): Tool {
  return new DynamicTool({
    name: 'json_processor',
    description: 'Process JSON data - format, validate or query',
    func: async (input: string) => {
      try {
        const parsed = JSON.parse(input);
        return JSON.stringify(parsed, null, 2);
      } catch (error) {
        return `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 获取所有 LangChain 官方工具
 */
export function getLangChainOfficialTools(): Tool[] {
  return [
    createReadFileTool(),
    createWriteFileTool(),
    createHttpGetTool(),
    createHttpPostTool(),
    createJsonTool(),
  ];
}

/**
 * 按类别分组的工具
 */
export const officialToolsByCategory = {
  filesystem: ['read_file', 'write_file'],
  http: ['http_get', 'http_post'],
  json: ['json_processor'],
};

/**
 * 获取文件系统工具
 */
export function getFileSystemTools(): Tool[] {
  return [createReadFileTool(), createWriteFileTool()];
}

/**
 * 获取 HTTP 工具
 */
export function getHttpTools(): Tool[] {
  return [createHttpGetTool(), createHttpPostTool()];
}

/**
 * 获取 JSON 工具
 */
export function getJsonTools(): Tool[] {
  return [createJsonTool()];
}

/**
 * 获取所有内置工具实例（兼容旧接口）
 */
export function getAllBuiltinTools(): Tool[] {
  return getLangChainOfficialTools();
}
