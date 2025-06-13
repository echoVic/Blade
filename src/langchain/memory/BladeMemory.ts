/**
 * Blade Memory - LangChain 集成
 * 智能记忆管理系统，提供会话记忆、上下文保持和知识存储
 */

import { FileProvider } from './providers/FileProvider.js';
import { InMemoryProvider } from './providers/InMemoryProvider.js';
import {
  BladeMemoryConfig,
  MemoryEntry,
  MemoryEvent,
  MemoryEventListener,
  MemoryExport,
  MemoryManager,
  MemoryMiddleware,
  MemoryProvider,
  MemorySearchQuery,
  MemoryStats,
  MemoryType,
} from './types.js';

/**
 * Blade Memory 主类
 * 提供完整的记忆管理功能
 */
export class BladeMemory implements MemoryManager {
  private config: BladeMemoryConfig;
  private provider: MemoryProvider;
  private middleware: MemoryMiddleware[] = [];
  private listeners: MemoryEventListener[] = [];
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private stats: Map<string, MemoryStats> = new Map();

  constructor(config: Partial<BladeMemoryConfig> = {}) {
    this.config = this.buildConfig(config);
    this.provider = this.createProvider();
    this.setupCleanup();
  }

  /**
   * 构建完整配置
   */
  private buildConfig(partial: Partial<BladeMemoryConfig>): BladeMemoryConfig {
    return {
      provider: partial.provider || new InMemoryProvider(),
      storage: {
        type: 'memory',
        ...partial.storage,
      },
      limits: {
        maxEntries: 10000,
        maxSizePerEntry: 1024 * 1024, // 1MB
        maxTotalSize: 100 * 1024 * 1024, // 100MB
        ttl: 7 * 24 * 60 * 60, // 7 days
        ...partial.limits,
      },
      cleanup: {
        strategy: 'lru',
        interval: 60 * 60, // 1 hour
        ...partial.cleanup,
      },
      compression: {
        enabled: false,
        threshold: 1024, // 1KB
        ...partial.compression,
      },
      encryption: {
        enabled: false,
        ...partial.encryption,
      },
      sync: {
        enabled: false,
        ...partial.sync,
      },
    };
  }

  /**
   * 创建存储提供者
   */
  private createProvider(): MemoryProvider {
    const { storage } = this.config;

    switch (storage.type) {
      case 'memory':
        return new InMemoryProvider();
      case 'file':
        return new FileProvider(storage.config || {});
      default:
        if (this.config.provider) {
          return this.config.provider;
        }
        throw new Error(`不支持的存储类型: ${storage.type}`);
    }
  }

  /**
   * 设置自动清理
   */
  private setupCleanup(): void {
    const { cleanup } = this.config;
    if (cleanup.interval && cleanup.interval > 0) {
      this.cleanupTimer = setInterval(async () => {
        try {
          await this.provider.cleanup();
        } catch (error) {
          this.emitEvent({
            type: 'error',
            sessionId: '',
            timestamp: new Date(),
            error: `清理失败: ${error}`,
          });
        }
      }, cleanup.interval * 1000);
    }
  }

  /**
   * 会话管理
   */
  async createSession(sessionId: string, userId?: string): Promise<void> {
    const existingEntries = await this.provider.get(sessionId);
    if (existingEntries.length === 0) {
      // 创建会话初始化条目
      const initEntry: MemoryEntry = {
        id: `session_${sessionId}_init`,
        sessionId,
        userId,
        type: MemoryType.SYSTEM_STATE,
        content: {
          sessionCreated: new Date(),
          userId,
          status: 'active',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        importance: 0.8,
      };

      await this.provider.set(initEntry);
      this.emitEvent({
        type: 'create',
        sessionId,
        entryId: initEntry.id,
        timestamp: new Date(),
        data: { action: 'session_created' },
      });
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.provider.clear(sessionId);
    this.stats.delete(sessionId);
    this.emitEvent({
      type: 'delete',
      sessionId,
      timestamp: new Date(),
      data: { action: 'session_deleted' },
    });
  }

  async listSessions(_userId?: string): Promise<string[]> {
    // 这需要基于实现的 provider 来获取所有会话
    // 简化实现，实际应该在 provider 中实现
    return [];
  }

  /**
   * 记忆操作
   */
  async remember(
    sessionId: string,
    type: MemoryType,
    content: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = this.generateId();
    const now = new Date();

    let entry: MemoryEntry = {
      id,
      sessionId,
      type,
      content,
      metadata,
      createdAt: now,
      updatedAt: now,
      importance: this.calculateImportance(type, content),
    };

    // 应用中间件
    for (const middleware of this.middleware) {
      if (middleware.beforeCreate) {
        const processedEntry = await middleware.beforeCreate(entry);
        if (!processedEntry) {
          return ''; // 中间件阻止了创建
        }
        entry = processedEntry;
      }
    }

    // 检查重复
    if (await this.isDuplicate(entry)) {
      return id; // 如果重复，返回现有ID
    }

    // 存储
    await this.provider.set(entry);

    // 应用中间件（创建后）
    for (const middleware of this.middleware) {
      if (middleware.afterCreate) {
        await middleware.afterCreate(entry);
      }
    }

    // 更新统计
    await this.updateStats(sessionId);

    this.emitEvent({
      type: 'create',
      sessionId,
      entryId: id,
      timestamp: now,
    });

    return id;
  }

  async recall(sessionId: string, query?: string, type?: MemoryType): Promise<MemoryEntry[]> {
    let entries: MemoryEntry[];

    if (query) {
      // 语义搜索
      const searchQuery: MemorySearchQuery = {
        sessionId,
        query,
        type: type ? [type] : undefined,
        limit: 50,
        sortBy: 'relevance',
      };

      // 应用中间件
      let processedQuery = searchQuery;
      for (const middleware of this.middleware) {
        if (middleware.beforeRead) {
          processedQuery = await middleware.beforeRead(processedQuery);
        }
      }

      entries = await this.provider.search(processedQuery);
    } else {
      // 简单获取
      entries = await this.provider.get(sessionId);
      if (type) {
        entries = entries.filter(entry => entry.type === type);
      }
    }

    // 更新访问计数
    for (const entry of entries) {
      entry.access_count = (entry.access_count || 0) + 1;
      entry.lastAccessedAt = new Date();
      await this.provider.update(entry.id, {
        access_count: entry.access_count,
        lastAccessedAt: entry.lastAccessedAt,
      });
    }

    // 应用中间件（读取后）
    for (const middleware of this.middleware) {
      if (middleware.afterRead) {
        entries = await middleware.afterRead(entries);
      }
    }

    this.emitEvent({
      type: 'access',
      sessionId,
      timestamp: new Date(),
      data: { count: entries.length, query, type },
    });

    return entries;
  }

  async forget(sessionId: string, entryId: string): Promise<void> {
    // 应用中间件
    for (const middleware of this.middleware) {
      if (middleware.beforeDelete) {
        const shouldDelete = await middleware.beforeDelete(entryId);
        if (!shouldDelete) {
          return; // 中间件阻止了删除
        }
      }
    }

    await this.provider.delete(entryId);

    // 应用中间件（删除后）
    for (const middleware of this.middleware) {
      if (middleware.afterDelete) {
        await middleware.afterDelete(entryId);
      }
    }

    await this.updateStats(sessionId);

    this.emitEvent({
      type: 'delete',
      sessionId,
      entryId,
      timestamp: new Date(),
    });
  }

  async update(sessionId: string, entryId: string, updates: Partial<MemoryEntry>): Promise<void> {
    // 应用中间件
    let processedUpdates = updates;
    for (const middleware of this.middleware) {
      if (middleware.beforeUpdate) {
        processedUpdates = await middleware.beforeUpdate(entryId, processedUpdates);
      }
    }

    processedUpdates.updatedAt = new Date();
    await this.provider.update(entryId, processedUpdates);

    // 应用中间件（更新后）
    const updatedEntries = await this.provider.get(sessionId);
    const updatedEntry = updatedEntries.find(e => e.id === entryId);

    if (updatedEntry) {
      for (const middleware of this.middleware) {
        if (middleware.afterUpdate) {
          await middleware.afterUpdate(updatedEntry);
        }
      }
    }

    this.emitEvent({
      type: 'update',
      sessionId,
      entryId,
      timestamp: new Date(),
    });
  }

  /**
   * 高级功能
   */
  async summarize(sessionId: string, maxEntries: number = 100): Promise<string> {
    const entries = await this.provider.get(sessionId);
    const recentEntries = entries
      .filter(e => e.type === MemoryType.CONVERSATION)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxEntries);

    if (recentEntries.length === 0) {
      return '暂无对话记录';
    }

    // 简化的摘要生成
    const conversations = recentEntries
      .map(entry => {
        const content = entry.content;
        return `${content.role}: ${content.message}`;
      })
      .join('\n');

    return `会话摘要 (最近${recentEntries.length}条消息):\n${conversations}`;
  }

  async compress(sessionId: string): Promise<number> {
    const entries = await this.provider.get(sessionId);
    const oldCount = entries.length;

    // 压缩策略：合并相似对话，删除低重要性条目
    const importantEntries = entries.filter(e => (e.importance || 0) >= 0.3);
    const lessImportantEntries = entries.filter(e => (e.importance || 0) < 0.3);

    // 删除低重要性条目
    for (const entry of lessImportantEntries) {
      await this.provider.delete(entry.id);
    }

    const newCount = importantEntries.length;
    await this.updateStats(sessionId);

    this.emitEvent({
      type: 'cleanup',
      sessionId,
      timestamp: new Date(),
      data: { originalCount: oldCount, compressedCount: newCount },
    });

    return oldCount - newCount;
  }

  async merge(sourceSessionId: string, targetSessionId: string): Promise<void> {
    const sourceEntries = await this.provider.get(sourceSessionId);

    for (const entry of sourceEntries) {
      const newEntry: MemoryEntry = {
        ...entry,
        id: this.generateId(),
        sessionId: targetSessionId,
        metadata: {
          ...entry.metadata,
          mergedFrom: sourceSessionId,
          mergedAt: new Date(),
        },
      };
      await this.provider.set(newEntry);
    }

    await this.deleteSession(sourceSessionId);
    await this.updateStats(targetSessionId);
  }

  /**
   * 统计和监控
   */
  async getStats(sessionId: string): Promise<MemoryStats> {
    const entries = await this.provider.get(sessionId);
    const totalSize = await this.provider.size(sessionId);

    const entriesByType: Record<MemoryType, number> = {} as any;
    for (const type of Object.values(MemoryType)) {
      entriesByType[type] = 0;
    }

    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;
    let totalImportance = 0;

    for (const entry of entries) {
      entriesByType[entry.type]++;
      totalImportance += entry.importance || 0;

      if (!oldestDate || entry.createdAt < oldestDate) {
        oldestDate = entry.createdAt;
      }
      if (!newestDate || entry.createdAt > newestDate) {
        newestDate = entry.createdAt;
      }
    }

    const stats: MemoryStats = {
      sessionId,
      totalEntries: entries.length,
      totalSize,
      entriesByType,
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    };

    this.stats.set(sessionId, stats);
    return stats;
  }

  /**
   * 事件系统
   */
  addEventListener(listener: MemoryEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: MemoryEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private emitEvent(event: MemoryEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('Memory event listener error:', error);
          });
        }
      } catch (error) {
        console.error('Memory event listener error:', error);
      }
    }
  }

  /**
   * 中间件管理
   */
  addMiddleware(middleware: MemoryMiddleware): void {
    this.middleware.push(middleware);
    this.middleware.sort((a, b) => b.priority - a.priority);
  }

  removeMiddleware(name: string): void {
    this.middleware = this.middleware.filter(m => m.name !== name);
  }

  /**
   * 辅助方法
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateImportance(type: MemoryType, content: any): number {
    // 基于类型和内容计算重要性
    switch (type) {
      case MemoryType.FACT:
        return 0.8;
      case MemoryType.PREFERENCE:
        return 0.7;
      case MemoryType.USER_PROFILE:
        return 0.9;
      case MemoryType.CONVERSATION:
        // 基于消息长度和关键词
        const message = content.message || '';
        let importance = 0.5;
        if (message.length > 100) importance += 0.1;
        if (message.includes('重要') || message.includes('记住')) importance += 0.2;
        return Math.min(importance, 1.0);
      default:
        return 0.5;
    }
  }

  private async isDuplicate(entry: MemoryEntry): Promise<boolean> {
    const existing = await this.provider.get(entry.sessionId);
    return existing.some(
      e => e.type === entry.type && JSON.stringify(e.content) === JSON.stringify(entry.content)
    );
  }

  private async updateStats(sessionId: string): Promise<void> {
    const stats = await this.getStats(sessionId);
    this.stats.set(sessionId, stats);
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.listeners.length = 0;
    this.middleware.length = 0;
    this.stats.clear();
  }

  /**
   * 导出和导入
   */
  async exportSession(sessionId: string): Promise<MemoryExport> {
    return await this.provider.export(sessionId);
  }

  async importSession(data: MemoryExport): Promise<void> {
    await this.provider.import(data);
    await this.updateStats(data.sessionId);
  }
}
