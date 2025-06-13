/**
 * LangChain 官方 Memory 适配器
 * 将官方 LangChain memory 模块适配到 Blade 系统
 */

import {
  BaseMemory,
  BufferMemory,
  ChatMessageHistory,
  ConversationSummaryMemory,
} from 'langchain/memory';
import {
  MemoryEntry,
  MemoryExport,
  MemoryFilterCriteria,
  MemoryProvider,
  MemorySearchQuery,
  MemoryType,
} from '../types.js';

/**
 * LangChain Memory 适配器
 * 让官方 LangChain memory 兼容 Blade 接口
 */
export class LangChainMemoryAdapter implements MemoryProvider {
  private memory: BaseMemory;
  private messageHistory: ChatMessageHistory;

  constructor(memoryType: 'buffer' | 'summary' = 'buffer') {
    this.messageHistory = new ChatMessageHistory();

    switch (memoryType) {
      case 'buffer':
        this.memory = new BufferMemory({
          chatHistory: this.messageHistory,
          returnMessages: true,
        });
        break;
      case 'summary':
        this.memory = new ConversationSummaryMemory({
          chatHistory: this.messageHistory,
          returnMessages: true,
        });
        break;
    }
  }

  async get(sessionId: string, key?: string): Promise<MemoryEntry[]> {
    const variables = await this.memory.loadMemoryVariables({});
    const messages = variables.history || variables.chat_history || [];

    return messages.map((msg: any, index: number) => ({
      id: `langchain_${sessionId}_${index}`,
      sessionId,
      type: MemoryType.CONVERSATION,
      content: {
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        message: msg.content,
        timestamp: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      importance: 0.5,
    }));
  }

  async set(entry: MemoryEntry): Promise<void> {
    if (entry.type === MemoryType.CONVERSATION) {
      const content = entry.content;
      if (content.role === 'user') {
        await this.messageHistory.addUserMessage(content.message);
      } else if (content.role === 'assistant') {
        await this.messageHistory.addAIMessage(content.message);
      }
    }
    // 其他类型的记忆暂时忽略，因为官方 memory 主要处理对话
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    // LangChain memory 不支持直接更新，需要重新构建
    console.warn('LangChain memory adapter does not support updates');
  }

  async delete(id: string): Promise<void> {
    // LangChain memory 不支持选择性删除
    console.warn('LangChain memory adapter does not support selective deletion');
  }

  async clear(sessionId: string): Promise<void> {
    await this.messageHistory.clear();
  }

  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    // 简单实现：获取所有条目然后过滤
    const entries = await this.get(query.sessionId);
    return entries.filter(entry => {
      const content = JSON.stringify(entry.content).toLowerCase();
      return content.includes(query.query.toLowerCase());
    });
  }

  async filter(criteria: MemoryFilterCriteria): Promise<MemoryEntry[]> {
    const entries = await this.get(criteria.sessionId);
    return entries.filter(entry => {
      if (criteria.type && !criteria.type.includes(entry.type)) {
        return false;
      }
      return true;
    });
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
    // LangChain memory 有自己的清理机制
    return 0;
  }

  async optimize(): Promise<void> {
    // 对于摘要类型的 memory，可以触发摘要操作
    if (this.memory instanceof ConversationSummaryMemory) {
      await this.memory.loadMemoryVariables({});
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
}
