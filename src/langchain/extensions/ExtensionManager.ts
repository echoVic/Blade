import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BladeToolkit } from '../tools/BladeToolkit.js';
import { MCPToolManager } from '../tools/mcp/MCPToolManager.js';
import {
  Extension,
  ExtensionAPI,
  ExtensionContext,
  ExtensionDescriptor,
  ExtensionEventEmitter,
  ExtensionLogger,
  ExtensionManagerEvent,
  ExtensionSearchOptions,
  ExtensionStats,
  ExtensionStatus,
  ExtensionStorage,
} from './types.js';

/**
 * 扩展管理器配置
 */
export interface ExtensionManagerConfig {
  extensionsDir: string;
  configDir: string;
  autoLoad?: boolean;
  maxConcurrentLoads?: number;
}

/**
 * 扩展存储实现
 */
class ExtensionStorageImpl implements ExtensionStorage {
  constructor(
    private extensionId: string,
    private configDir: string
  ) {}

  private getStoragePath(key: string): string {
    return path.join(this.configDir, 'storage', this.extensionId, `${key}.json`);
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    try {
      const filePath = this.getStoragePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const filePath = this.getStoragePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getStoragePath(key);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    const storageDir = path.join(this.configDir, 'storage', this.extensionId);
    try {
      await fs.rm(storageDir, { recursive: true });
    } catch {
      // 目录不存在，忽略错误
    }
  }

  async keys(): Promise<string[]> {
    const storageDir = path.join(this.configDir, 'storage', this.extensionId);
    try {
      const files = await fs.readdir(storageDir);
      return files.map(file => path.basename(file, '.json'));
    } catch {
      return [];
    }
  }
}

/**
 * 扩展日志实现
 */
class ExtensionLoggerImpl implements ExtensionLogger {
  constructor(private extensionId: string) {}

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.extensionId}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(this.formatMessage('debug', message), ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(this.formatMessage('info', message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message), ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('error', message), ...args);
  }
}

/**
 * 扩展管理器
 * 负责扩展的生命周期管理、依赖解析和资源分配
 */
export class ExtensionManager extends EventEmitter {
  private extensions: Map<string, ExtensionDescriptor> = new Map();
  private extensionInstances: Map<string, Extension> = new Map();
  private loading: Set<string> = new Set();
  private toolkit: BladeToolkit;
  private mcpManager: MCPToolManager;
  private stats: ExtensionStats = {
    totalExtensions: 0,
    activeExtensions: 0,
    extensionsByType: {},
    extensionsByStatus: {},
    averageLoadTime: 0,
    averageActivateTime: 0,
    totalMemoryUsage: 0,
    lastUpdate: new Date(),
  };

  constructor(
    private config: ExtensionManagerConfig,
    toolkit: BladeToolkit,
    mcpManager: MCPToolManager
  ) {
    super();
    this.toolkit = toolkit;
    this.mcpManager = mcpManager;

    // 创建必要的目录
    this.ensureDirectories();

    // 自动加载扩展
    if (this.config.autoLoad) {
      this.loadAllExtensions().catch(error => {
        this.emit('error', { operation: 'autoLoad', error });
      });
    }
  }

  /**
   * 激活扩展
   */
  async activateExtension(extensionId: string): Promise<void> {
    const descriptor = this.extensions.get(extensionId);
    if (!descriptor) {
      throw new Error(`扩展不存在: ${extensionId}`);
    }

    if (descriptor.status === ExtensionStatus.ACTIVE) {
      return; // 已经激活
    }

    if (this.loading.has(extensionId)) {
      throw new Error(`扩展正在加载中: ${extensionId}`);
    }

    this.loading.add(extensionId);
    descriptor.status = ExtensionStatus.LOADING;

    try {
      const startTime = Date.now();

      // 加载扩展实例
      const instance = await this.loadExtensionInstance(extensionId);

      // 创建扩展上下文
      const context = this.createExtensionContext(extensionId);

      // 激活扩展
      await instance.activate(context);

      const activateTime = Date.now() - startTime;
      descriptor.status = ExtensionStatus.ACTIVE;
      descriptor.activateTime = activateTime;

      this.extensionInstances.set(extensionId, instance);
      this.updateStats();

      this.emit(ExtensionManagerEvent.EXTENSION_ACTIVATED, {
        extensionId,
        activateTime,
      });
    } catch (error) {
      descriptor.status = ExtensionStatus.ERROR;
      descriptor.error = error instanceof Error ? error.message : String(error);

      this.emit(ExtensionManagerEvent.EXTENSION_ERROR, {
        extensionId,
        operation: 'activate',
        error,
      });
      throw error;
    } finally {
      this.loading.delete(extensionId);
    }
  }

  /**
   * 停用扩展
   */
  async deactivateExtension(extensionId: string): Promise<void> {
    const descriptor = this.extensions.get(extensionId);
    const instance = this.extensionInstances.get(extensionId);

    if (!descriptor || !instance) {
      return; // 扩展未激活
    }

    try {
      await instance.deactivate();
      descriptor.status = ExtensionStatus.INACTIVE;

      this.extensionInstances.delete(extensionId);
      this.updateStats();

      this.emit(ExtensionManagerEvent.EXTENSION_DEACTIVATED, { extensionId });
    } catch (error) {
      descriptor.status = ExtensionStatus.ERROR;
      descriptor.error = error instanceof Error ? error.message : String(error);

      this.emit(ExtensionManagerEvent.EXTENSION_ERROR, {
        extensionId,
        operation: 'deactivate',
        error,
      });
      throw error;
    }
  }

  /**
   * 搜索扩展
   */
  searchExtensions(options: ExtensionSearchOptions = {}): ExtensionDescriptor[] {
    const results: ExtensionDescriptor[] = [];

    for (const descriptor of this.extensions.values()) {
      let matches = true;

      if (options.type && descriptor.metadata.type !== options.type) {
        matches = false;
      }

      if (options.category && descriptor.metadata.category !== options.category) {
        matches = false;
      }

      if (options.status && descriptor.status !== options.status) {
        matches = false;
      }

      if (options.author && descriptor.metadata.author !== options.author) {
        matches = false;
      }

      if (options.namePattern) {
        const regex = new RegExp(options.namePattern, 'i');
        if (!regex.test(descriptor.metadata.name)) {
          matches = false;
        }
      }

      if (options.keywords && options.keywords.length > 0) {
        const hasKeyword = options.keywords.some(keyword =>
          descriptor.metadata.keywords?.includes(keyword)
        );
        if (!hasKeyword) {
          matches = false;
        }
      }

      if (matches) {
        results.push(descriptor);
      }
    }

    return results;
  }

  /**
   * 创建扩展上下文
   */
  private createExtensionContext(extensionId: string): ExtensionContext {
    const logger = new ExtensionLoggerImpl(extensionId);
    const storage = new ExtensionStorageImpl(extensionId, this.config.configDir);
    const events = this as ExtensionEventEmitter;

    const api: ExtensionAPI = {
      // 工具相关
      registerTool: async tool => {
        this.toolkit.registerTool(tool);
      },
      unregisterTool: async toolName => {
        // 实现工具注销逻辑
      },
      getTool: toolName => {
        return this.toolkit.getTool(toolName);
      },
      listTools: (): any[] => {
        return this.toolkit.getAllTools();
      },

      // Agent 相关 - 待实现
      registerAgent: async () => {},
      unregisterAgent: async () => {},
      getAgent: () => null,
      listAgents: () => [],

      // 模型相关 - 待实现
      registerModel: async () => {},
      unregisterModel: async () => {},
      getModel: () => null,
      listModels: () => [],

      // MCP 相关
      registerMCPServer: async config => {
        this.mcpManager.addServer(config);
      },
      unregisterMCPServer: async serverName => {
        this.mcpManager.removeServer(serverName);
      },
      getMCPServers: () => {
        return Array.from(this.mcpManager.getSessions().values());
      },

      // 配置相关
      getConfig: <T = any>(key: string): T | undefined => {
        const descriptor = this.extensions.get(extensionId);
        return descriptor?.config.config?.[key];
      },
      setConfig: async <T = any>(key: string, value: T) => {
        // 实现配置设置逻辑
      },

      // 通知相关
      showMessage: (message, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`);
      },
      showProgress: async (title, task) => {
        console.log(`开始: ${title}`);
        try {
          const result = await task;
          console.log(`完成: ${title}`);
          return result;
        } catch (error) {
          console.log(`失败: ${title}`, error);
          throw error;
        }
      },
    };

    return {
      extensionId,
      workspace: process.cwd(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      logger,
      storage,
      events,
      api,
    };
  }

  /**
   * 加载扩展实例
   */
  private async loadExtensionInstance(extensionId: string): Promise<Extension> {
    const descriptor = this.extensions.get(extensionId);
    if (!descriptor) {
      throw new Error(`扩展不存在: ${extensionId}`);
    }

    // 简化的扩展实例创建
    const mockExtension: Extension = {
      metadata: descriptor.metadata,
      status: ExtensionStatus.INACTIVE,

      async activate(context: ExtensionContext): Promise<void> {
        context.logger.info(`激活扩展: ${this.metadata.name}`);
      },

      async deactivate(): Promise<void> {
        // 停用逻辑
      },

      async configure(config: Record<string, any>): Promise<void> {
        // 配置逻辑
      },

      isActive(): boolean {
        return this.status === ExtensionStatus.ACTIVE;
      },

      getConfig(): Record<string, any> {
        return {};
      },

      getContext(): ExtensionContext | undefined {
        return undefined;
      },
    };

    return mockExtension;
  }

  /**
   * 加载所有扩展
   */
  private async loadAllExtensions(): Promise<void> {
    // 简化实现
    this.updateStats();
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalExtensions = this.extensions.size;
    this.stats.activeExtensions = Array.from(this.extensions.values()).filter(
      d => d.status === ExtensionStatus.ACTIVE
    ).length;

    this.stats.lastUpdate = new Date();
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.config.extensionsDir, { recursive: true });
    await fs.mkdir(path.join(this.config.configDir, 'extensions'), { recursive: true });
    await fs.mkdir(path.join(this.config.configDir, 'storage'), { recursive: true });
  }

  /**
   * 获取所有扩展
   */
  getExtensions(): Map<string, ExtensionDescriptor> {
    return new Map(this.extensions);
  }

  /**
   * 获取活跃扩展
   */
  getActiveExtensions(): Map<string, Extension> {
    return new Map(this.extensionInstances);
  }

  /**
   * 获取统计信息
   */
  getStats(): ExtensionStats {
    return { ...this.stats };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    const deactivatePromises = Array.from(this.extensionInstances.keys()).map(
      id => this.deactivateExtension(id).catch(() => {}) // 忽略错误
    );

    await Promise.allSettled(deactivatePromises);

    this.extensions.clear();
    this.extensionInstances.clear();
    this.loading.clear();
  }
}
