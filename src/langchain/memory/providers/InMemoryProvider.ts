/**
 * 内存存储提供者
 * 在进程内存中存储记忆数据
 */

import {
  MemoryEntry,
  MemoryExport,
  MemoryFilterCriteria,
  MemoryProvider,
  MemorySearchQuery,
  MemoryType,
} from '../types.js';

/**
 * 内存存储提供者实现
 */
export class InMemoryProvider implements MemoryProvider {
  private storage: Map<string, Map<string, MemoryEntry>> = new Map();

  async get(sessionId: string, key?: string): Promise<MemoryEntry[]> {
    const sessionData = this.storage.get(sessionId);
    if (!sessionData) {
      return [];
    }

    if (key) {
      const entry = sessionData.get(key);
      return entry ? [entry] : [];
    }

    return Array.from(sessionData.values());
  }

  async set(entry: MemoryEntry): Promise<void> {
    if (!this.storage.has(entry.sessionId)) {
      this.storage.set(entry.sessionId, new Map());
    }

    const sessionData = this.storage.get(entry.sessionId)!;
    sessionData.set(entry.id, { ...entry });
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    for (const [, sessionData] of this.storage) {
      if (sessionData.has(id)) {
        const existing = sessionData.get(id)!;
        sessionData.set(id, { ...existing, ...updates });
        return;
      }
    }
    throw new Error(`Memory entry not found: ${id}`);
  }

  async delete(id: string): Promise<void> {
    for (const [, sessionData] of this.storage) {
      if (sessionData.has(id)) {
        sessionData.delete(id);
        return;
      }
    }
  }

  async clear(sessionId: string): Promise<void> {
    this.storage.delete(sessionId);
  }

  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    const entries = await this.get(query.sessionId);

    let filtered = entries;

    // 类型过滤
    if (query.type && query.type.length > 0) {
      filtered = filtered.filter(entry => query.type!.includes(entry.type));
    }

    // 时间范围过滤
    if (query.timeRange) {
      filtered = filtered.filter(entry => {
        if (query.timeRange!.start && entry.createdAt < query.timeRange!.start) {
          return false;
        }
        if (query.timeRange!.end && entry.createdAt > query.timeRange!.end) {
          return false;
        }
        return true;
      });
    }

    // 过期条目过滤
    if (!query.includeExpired) {
      const now = new Date();
      filtered = filtered.filter(entry => !entry.expiresAt || entry.expiresAt > now);
    }

    // 简单文本搜索
    if (query.query) {
      const searchText = query.query.toLowerCase();
      filtered = filtered.filter(entry => {
        const content = JSON.stringify(entry.content).toLowerCase();
        return content.includes(searchText);
      });
    }

    // 排序
    if (query.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (query.sortBy) {
          case 'createdAt':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'importance':
            comparison = (a.importance || 0) - (b.importance || 0);
            break;
          case 'access_count':
            comparison = (a.access_count || 0) - (b.access_count || 0);
            break;
          case 'relevance':
          default:
            // 简单相关性评分
            const aScore = this.calculateRelevance(a, query.query || '');
            const bScore = this.calculateRelevance(b, query.query || '');
            comparison = aScore - bScore;
            break;
        }
        return query.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // 分页
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : undefined;
    return filtered.slice(start, end);
  }

  async filter(criteria: MemoryFilterCriteria): Promise<MemoryEntry[]> {
    const entries = await this.get(criteria.sessionId);

    let filtered = entries;

    // 用户过滤
    if (criteria.userId) {
      filtered = filtered.filter(entry => entry.userId === criteria.userId);
    }

    // 类型过滤
    if (criteria.type && criteria.type.length > 0) {
      filtered = filtered.filter(entry => criteria.type!.includes(entry.type));
    }

    // 重要性过滤
    if (criteria.importance) {
      filtered = filtered.filter(entry => {
        const importance = entry.importance || 0;
        if (criteria.importance!.min !== undefined && importance < criteria.importance!.min) {
          return false;
        }
        if (criteria.importance!.max !== undefined && importance > criteria.importance!.max) {
          return false;
        }
        return true;
      });
    }

    // 时间过滤
    if (criteria.createdAt) {
      filtered = filtered.filter(entry => {
        if (criteria.createdAt!.start && entry.createdAt < criteria.createdAt!.start) {
          return false;
        }
        if (criteria.createdAt!.end && entry.createdAt > criteria.createdAt!.end) {
          return false;
        }
        return true;
      });
    }

    // 过期条目过滤
    if (!criteria.includeExpired) {
      const now = new Date();
      filtered = filtered.filter(entry => !entry.expiresAt || entry.expiresAt > now);
    }

    // 分页
    const start = criteria.offset || 0;
    const end = criteria.limit ? start + criteria.limit : undefined;
    return filtered.slice(start, end);
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
      const size = JSON.stringify(entry).length;
      return total + size;
    }, 0);
  }

  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();

    for (const [sessionId, sessionData] of this.storage) {
      const toDelete: string[] = [];

      for (const [id, entry] of sessionData) {
        if (entry.expiresAt && entry.expiresAt <= now) {
          toDelete.push(id);
        }
      }

      for (const id of toDelete) {
        sessionData.delete(id);
        cleanedCount++;
      }

      // 如果会话为空，删除会话
      if (sessionData.size === 0) {
        this.storage.delete(sessionId);
      }
    }

    return cleanedCount;
  }

  async optimize(): Promise<void> {
    // 内存存储不需要优化
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
   * 计算相关性分数
   */
  private calculateRelevance(entry: MemoryEntry, query: string): number {
    if (!query) {
      return entry.importance || 0;
    }

    const content = JSON.stringify(entry.content).toLowerCase();
    const queryLower = query.toLowerCase();

    let score = 0;

    // 精确匹配
    if (content.includes(queryLower)) {
      score += 1.0;
    }

    // 词语匹配
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (content.includes(word)) {
        score += 0.5;
      }
    }

    // 重要性加权
    score += (entry.importance || 0) * 0.3;

    // 访问次数加权
    score += Math.log((entry.access_count || 0) + 1) * 0.1;

    return score;
  }
}
