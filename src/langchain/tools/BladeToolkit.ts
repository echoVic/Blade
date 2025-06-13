/**
 * BladeToolkit - LangChain 原生工具管理器
 * 管理和调用 LangChain 官方工具
 */

import { Tool } from '@langchain/core/tools';
import {
  getFileSystemTools,
  getHttpTools,
  getJsonTools,
  getLangChainOfficialTools,
} from './builtin/index.js';

/**
 * BladeToolkit 管理器
 * 负责工具注册、发现和执行
 */
export class BladeToolkit {
  private tools: Map<string, Tool> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeTools();
  }

  /**
   * 初始化工具
   */
  private initializeTools(): void {
    try {
      // 注册 LangChain 官方工具
      const officialTools = getLangChainOfficialTools();

      for (const tool of officialTools) {
        this.tools.set(tool.name, tool);
      }

      this.isInitialized = true;
      console.log(`✅ 已加载 ${this.tools.size} 个 LangChain 官方工具`);
    } catch (error) {
      console.error('❌ 工具初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有工具
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 根据名称获取工具
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取文件系统工具
   */
  public getFileSystemTools(): Tool[] {
    return getFileSystemTools();
  }

  /**
   * 获取 HTTP 工具
   */
  public getHttpTools(): Tool[] {
    return getHttpTools();
  }

  /**
   * 获取 JSON 工具
   */
  public getJsonTools(): Tool[] {
    return getJsonTools();
  }

  /**
   * 检查工具是否存在
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取工具数量
   */
  public getToolCount(): number {
    return this.tools.size;
  }

  /**
   * 获取工具名称列表
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 转换为 LangChain Tools 数组（用于 Agent）
   */
  public toLangChainTools(): Tool[] {
    return this.getAllTools();
  }

  /**
   * 获取工具元数据
   */
  public getMetadata() {
    return {
      initialized: this.isInitialized,
      toolCount: this.getToolCount(),
      toolNames: this.getToolNames(),
      version: '3.0.0',
      type: 'LangChain Official Tools',
    };
  }
}
