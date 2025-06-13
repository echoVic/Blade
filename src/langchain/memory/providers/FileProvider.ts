/**
 * 文件存储提供者
 * 在文件系统中持久化存储记忆数据
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MemoryEntry,
  MemoryExport,
  MemoryFilterCriteria,
  MemoryProvider,
  MemorySearchQuery,
  MemoryType,
} from '../types.js';
import { InMemoryProvider } from './InMemoryProvider.js';

interface FileProviderConfig {
  dataDir?: string;
  useCache?: boolean;
  autoFlush?: boolean;
  flushInterval?: number;
}

/**
 * 文件存储提供者实现
 */
export class FileProvider implements MemoryProvider {
  private config: Required<FileProviderConfig>;
  private cache: InMemoryProvider;
  private flushTimer?: ReturnType<typeof setInterval>;
  private isDirty: Set<string> = new Set();

  constructor(config: FileProviderConfig = {}) {
    this.config = {
      dataDir: path.join(process.cwd(), '.blade-memory'),
      useCache: true,
      autoFlush: true,
      flushInterval: 30000, // 30 seconds
      ...config,
    };

    this.cache = new InMemoryProvider();
    this.setupAutoFlush();
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create data directory:', error);
    }
  }

  private setupAutoFlush(): void {
    if (this.config.autoFlush && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(async () => {
        await this.flushAll();
      }, this.config.flushInterval);
    }
  }

  private getSessionFile(sessionId: string): string {
    return path.join(this.config.dataDir, `${sessionId}.json`);
  }

  private async loadSession(sessionId: string): Promise<void> {
    if (!this.config.useCache) {
      return;
    }

    const filePath = this.getSessionFile(sessionId);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(data, (key, value) => {
        // 恢复 Date 对象
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });

      // 加载到缓存
      for (const entry of entries) {
        await this.cache.set(entry);
      }
    } catch (error) {
      // 文件不存在或损坏，忽略错误
    }
  }

  private async saveSession(sessionId: string): Promise<void> {
    const entries = await this.cache.get(sessionId);
    const filePath = this.getSessionFile(sessionId);

    try {
      const data = JSON.stringify(entries, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
      this.isDirty.delete(sessionId);
    } catch (error) {
      console.error(`Failed to save session ${sessionId}:`, error);
    }
  }

  private async flushAll(): Promise<void> {
    const promises = Array.from(this.isDirty).map(sessionId => this.saveSession(sessionId));
    await Promise.all(promises);
  }

  async get(sessionId: string, key?: string): Promise<MemoryEntry[]> {
    if (this.config.useCache) {
      await this.loadSession(sessionId);
      return this.cache.get(sessionId, key);
    }

    // 直接从文件读取
    const filePath = this.getSessionFile(sessionId);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });

      if (key) {
        return entries.filter(entry => entry.id === key);
      }
      return entries;
    } catch (error) {
      return [];
    }
  }

  async set(entry: MemoryEntry): Promise<void> {
    if (this.config.useCache) {
      await this.cache.set(entry);
      this.isDirty.add(entry.sessionId);

      if (!this.config.autoFlush) {
        await this.saveSession(entry.sessionId);
      }
    } else {
      const entries = await this.get(entry.sessionId);
      const index = entries.findIndex(e => e.id === entry.id);

      if (index >= 0) {
        entries[index] = entry;
      } else {
        entries.push(entry);
      }

      const filePath = this.getSessionFile(entry.sessionId);
      const data = JSON.stringify(entries, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    }
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    if (this.config.useCache) {
      await this.cache.update(id, updates);

      // 找到对应的会话ID
      for (const [sessionId] of this.isDirty) {
        const entries = await this.cache.get(sessionId);
        if (entries.some(e => e.id === id)) {
          this.isDirty.add(sessionId);
          break;
        }
      }
    } else {
      // 直接文件操作
      const sessions = await this.listSessions();
      for (const sessionId of sessions) {
        const entries = await this.get(sessionId);
        const index = entries.findIndex(e => e.id === id);

        if (index >= 0) {
          entries[index] = { ...entries[index], ...updates };
          const filePath = this.getSessionFile(sessionId);
          const data = JSON.stringify(entries, null, 2);
          await fs.writeFile(filePath, data, 'utf-8');
          return;
        }
      }
      throw new Error(`Memory entry not found: ${id}`);
    }
  }

  async delete(id: string): Promise<void> {
    if (this.config.useCache) {
      await this.cache.delete(id);

      // 标记所有相关会话为脏
      const sessions = await this.listSessions();
      for (const sessionId of sessions) {
        this.isDirty.add(sessionId);
      }
    } else {
      const sessions = await this.listSessions();
      for (const sessionId of sessions) {
        const entries = await this.get(sessionId);
        const filtered = entries.filter(e => e.id !== id);

        if (filtered.length !== entries.length) {
          const filePath = this.getSessionFile(sessionId);
          const data = JSON.stringify(filtered, null, 2);
          await fs.writeFile(filePath, data, 'utf-8');
          return;
        }
      }
    }
  }

  async clear(sessionId: string): Promise<void> {
    if (this.config.useCache) {
      await this.cache.clear(sessionId);
      this.isDirty.delete(sessionId);
    }

    const filePath = this.getSessionFile(sessionId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // 文件可能不存在，忽略错误
    }
  }

  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    if (this.config.useCache) {
      await this.loadSession(query.sessionId);
      return this.cache.search(query);
    }

    const entries = await this.get(query.sessionId);
    // 使用内存提供者的搜索逻辑
    const tempProvider = new InMemoryProvider();
    for (const entry of entries) {
      await tempProvider.set(entry);
    }
    return tempProvider.search(query);
  }

  async filter(criteria: MemoryFilterCriteria): Promise<MemoryEntry[]> {
    if (this.config.useCache) {
      await this.loadSession(criteria.sessionId);
      return this.cache.filter(criteria);
    }

    const entries = await this.get(criteria.sessionId);
    const tempProvider = new InMemoryProvider();
    for (const entry of entries) {
      await tempProvider.set(entry);
    }
    return tempProvider.filter(criteria);
  }

  async count(sessionId: string, type?: MemoryType): Promise<number> {
    const entries = await this.get(sessionId);
    if (type) {
      return entries.filter(entry => entry.type === type).length;
    }
    return entries.length;
  }

  async size(sessionId: string): Promise<number> {
    const entries = await this.get(sessionId);
    return entries.reduce((total, entry) => {
      return total + JSON.stringify(entry).length;
    }, 0);
  }

  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const sessions = await this.listSessions();
    const now = new Date();

    for (const sessionId of sessions) {
      const entries = await this.get(sessionId);
      const validEntries = entries.filter(entry => {
        const isExpired = entry.expiresAt && entry.expiresAt <= now;
        if (isExpired) {
          cleanedCount++;
        }
        return !isExpired;
      });

      if (validEntries.length !== entries.length) {
        if (validEntries.length === 0) {
          await this.clear(sessionId);
        } else {
          const filePath = this.getSessionFile(sessionId);
          const data = JSON.stringify(validEntries, null, 2);
          await fs.writeFile(filePath, data, 'utf-8');
        }
      }
    }

    return cleanedCount;
  }

  async optimize(): Promise<void> {
    // 压缩文件，移除空白
    const sessions = await this.listSessions();

    for (const sessionId of sessions) {
      const entries = await this.get(sessionId);
      if (entries.length > 0) {
        const filePath = this.getSessionFile(sessionId);
        const data = JSON.stringify(entries);
        await fs.writeFile(filePath, data, 'utf-8');
      }
    }
  }

  async export(sessionId: string): Promise<MemoryExport> {
    const entries = await this.get(sessionId);
    return {
      version: '1.0.0',
      exportedAt: new Date(),
      sessionId,
      entries,
    };
  }

  async import(data: MemoryExport): Promise<void> {
    for (const entry of data.entries) {
      await this.set(entry);
    }
  }

  /**
   * 列出所有会话
   */
  private async listSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.dataDir);
      return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * 手动刷新到磁盘
   */
  async flush(): Promise<void> {
    await this.flushAll();
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushAll();
  }
}
