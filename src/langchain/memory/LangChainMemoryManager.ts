/**
 * LangChain Memory Manager
 * 完全基于 LangChain 官方 memory 系统的实现
 */

import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import {
  BaseMemory,
  BufferMemory,
  BufferWindowMemory,
  ChatMessageHistory,
  ConversationSummaryBufferMemory,
  ConversationSummaryMemory,
  ConversationTokenBufferMemory,
} from 'langchain/memory';
import {
  MemoryEntry,
  MemoryEvent,
  MemoryEventListener,
  MemoryManager,
  MemoryStats,
  MemoryType,
} from './types.js';

export interface LangChainMemoryConfig {
  type: 'buffer' | 'window' | 'summary' | 'summary_buffer' | 'token_buffer';
  options?: {
    // Buffer Window 配置
    k?: number; // 保留消息数量
    // Token Buffer 配置
    maxTokenLimit?: number; // token 限制
    // Summary 配置
    llm?: ChatOpenAI; // 用于摘要的 LLM
    maxTokens?: number; // 摘要的最大 tokens
    // Summary Buffer 配置
    maxTokenLimitInSummaryBuffer?: number;
  };
}

/**
 * LangChain 记忆管理器
 * 利用 LangChain 的强大 memory 能力
 */
export class LangChainMemoryManager implements MemoryManager {
  private memories: Map<string, BaseMemory> = new Map();
  private messageHistories: Map<string, ChatMessageHistory> = new Map();
  private listeners: MemoryEventListener[] = [];
  private config: LangChainMemoryConfig;

  constructor(config: LangChainMemoryConfig) {
    this.config = config;
  }

  /**
   * 为每个会话创建专用的 memory 实例
   */
  private async getOrCreateMemory(sessionId: string): Promise<BaseMemory> {
    if (!this.memories.has(sessionId)) {
      const messageHistory = new ChatMessageHistory();
      this.messageHistories.set(sessionId, messageHistory);

      const memory = await this.createMemoryInstance(messageHistory);
      this.memories.set(sessionId, memory);
    }

    return this.memories.get(sessionId)!;
  }

  private async createMemoryInstance(messageHistory: ChatMessageHistory): Promise<BaseMemory> {
    const { type, options = {} } = this.config;

    switch (type) {
      case 'buffer':
        return new BufferMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
        });

      case 'window':
        return new BufferWindowMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
          k: options.k || 10,
        });

      case 'summary':
        return new ConversationSummaryMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
          llm: options.llm || new ChatOpenAI({ temperature: 0 }),
        });

      case 'summary_buffer':
        return new ConversationSummaryBufferMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
          llm: options.llm || new ChatOpenAI({ temperature: 0 }),
          maxTokenLimit: options.maxTokenLimitInSummaryBuffer || 2000,
        });

      case 'token_buffer':
        return new ConversationTokenBufferMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
          llm: options.llm || new ChatOpenAI({ temperature: 0 }),
          maxTokenLimit: options.maxTokenLimit || 2000,
        });

      default:
        return new BufferMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
        });
    }
  }

  /**
   * 会话管理
   */
  async createSession(sessionId: string, userId?: string): Promise<void> {
    await this.getOrCreateMemory(sessionId);

    // 添加系统消息标记会话开始
    const messageHistory = this.messageHistories.get(sessionId)!;
    await messageHistory.addMessage(
      new SystemMessage({
        content: `会话开始 - SessionID: ${sessionId}${userId ? `, UserID: ${userId}` : ''}`,
      })
    );

    this.emitEvent({
      type: 'create',
      sessionId,
      timestamp: new Date(),
      data: { userId },
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const messageHistory = this.messageHistories.get(sessionId);
    if (messageHistory) {
      await messageHistory.clear();
    }

    this.memories.delete(sessionId);
    this.messageHistories.delete(sessionId);

    this.emitEvent({
      type: 'delete',
      sessionId,
      timestamp: new Date(),
    });
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.memories.keys());
  }

  /**
   * 记忆操作 - 充分利用 LangChain 的能力
   */
  async remember(
    sessionId: string,
    type: MemoryType,
    content: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    const messageHistory = this.messageHistories.get(sessionId)!;
    const id = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (type === MemoryType.CONVERSATION) {
      // 对话记忆：直接使用 LangChain 的消息系统
      const role = content.role || 'user';
      const message = content.message || content;

      if (role === 'user' || role === 'human') {
        await messageHistory.addUserMessage(message);
      } else if (role === 'assistant' || role === 'ai') {
        await messageHistory.addAIMessage(message);
      } else if (role === 'system') {
        await messageHistory.addMessage(new SystemMessage({ content: message }));
      }
    } else {
      // 其他类型记忆：作为系统消息存储
      const structuredContent = {
        type: type,
        data: content,
        metadata: metadata,
        timestamp: new Date().toISOString(),
        id: id,
      };

      await messageHistory.addMessage(
        new SystemMessage({
          content: `[${type.toUpperCase()}] ${JSON.stringify(structuredContent)}`,
        })
      );
    }

    this.emitEvent({
      type: 'create',
      sessionId,
      entryId: id,
      timestamp: new Date(),
      data: { type, content, metadata },
    });

    return id;
  }

  async recall(sessionId: string, query?: string, type?: MemoryType): Promise<MemoryEntry[]> {
    const messageHistory = this.messageHistories.get(sessionId);

    if (!messageHistory) {
      return [];
    }

    // 获取所有消息
    const messages = await messageHistory.getMessages();
    const entries: MemoryEntry[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const entryId = `${sessionId}_${i}`;

      if (
        msg instanceof SystemMessage &&
        typeof msg.content === 'string' &&
        msg.content.startsWith('[')
      ) {
        // 解析结构化数据
        try {
          const match = msg.content.match(/\[(\w+)\] (.+)/);
          if (match) {
            const [, msgType, jsonData] = match;
            const data = JSON.parse(jsonData);

            if (!type || msgType.toLowerCase() === type) {
              entries.push({
                id: data.id || entryId,
                sessionId,
                type: msgType.toLowerCase() as MemoryType,
                content: data.data,
                metadata: data.metadata,
                createdAt: new Date(data.timestamp),
                updatedAt: new Date(data.timestamp),
                importance: 0.7,
              });
            }
          }
        } catch (error) {
          // 忽略解析错误
        }
      } else if (!type || type === MemoryType.CONVERSATION) {
        // 普通对话消息
        const role =
          msg instanceof HumanMessage ? 'user' : msg instanceof AIMessage ? 'assistant' : 'system';

        entries.push({
          id: entryId,
          sessionId,
          type: MemoryType.CONVERSATION,
          content: {
            role,
            message: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          importance: 0.6,
        });
      }
    }

    // 查询过滤
    if (query) {
      return entries.filter(entry => {
        const content = JSON.stringify(entry.content).toLowerCase();
        return content.includes(query.toLowerCase());
      });
    }

    this.emitEvent({
      type: 'access',
      sessionId,
      timestamp: new Date(),
      data: { query, type, resultCount: entries.length },
    });

    return entries;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async forget(_sessionId: string, _entryId: string): Promise<void> {
    console.warn('LangChain memory 不支持选择性删除单个条目');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(
    _sessionId: string,
    _entryId: string,
    _updates: Partial<MemoryEntry>
  ): Promise<void> {
    console.warn('LangChain memory 不支持直接更新条目');
  }

  /**
   * 高级功能
   */
  async summarize(sessionId: string, maxEntries = 50): Promise<string> {
    const entries = await this.recall(sessionId, undefined, MemoryType.CONVERSATION);
    const recentEntries = entries.slice(-maxEntries);

    if (recentEntries.length === 0) {
      return '暂无对话记录';
    }

    const conversations = recentEntries
      .map(entry => {
        const content = entry.content;
        return `${content.role}: ${content.message}`;
      })
      .join('\n');

    return `会话摘要 (${recentEntries.length} 条消息):\n${conversations}`;
  }

  async compress(): Promise<number> {
    return 0;
  }

  async merge(sourceSessionId: string, targetSessionId: string): Promise<void> {
    const sourceMessages = (await this.messageHistories.get(sourceSessionId)?.getMessages()) || [];
    const targetHistory = this.messageHistories.get(targetSessionId);

    if (!targetHistory) {
      await this.createSession(targetSessionId);
    }

    const targetMessageHistory = this.messageHistories.get(targetSessionId)!;

    // 将源会话的所有消息复制到目标会话
    for (const message of sourceMessages) {
      await targetMessageHistory.addMessage(message);
    }

    // 删除源会话
    await this.deleteSession(sourceSessionId);
  }

  async getStats(sessionId: string): Promise<MemoryStats> {
    const entries = await this.recall(sessionId);

    // 计算类型分布
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

    const memoryVars = await this.getMemoryVariables(sessionId);
    const memorySize = JSON.stringify(memoryVars).length;

    return {
      sessionId,
      totalEntries: entries.length,
      totalSize: memorySize,
      entriesByType,
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    };
  }

  /**
   * 获取 LangChain memory 实例
   */
  async getMemoryInstance(sessionId: string): Promise<BaseMemory> {
    return this.getOrCreateMemory(sessionId);
  }

  /**
   * 获取 memory 变量（LangChain 原生接口）
   */
  async getMemoryVariables(
    sessionId: string,
    inputs?: Record<string, any>
  ): Promise<Record<string, any>> {
    const memory = await this.getOrCreateMemory(sessionId);
    return memory.loadMemoryVariables(inputs || {});
  }

  /**
   * 保存上下文（LangChain 原生接口）
   */
  async saveContext(
    sessionId: string,
    inputs: Record<string, any>,
    outputs: Record<string, any>
  ): Promise<void> {
    const memory = await this.getOrCreateMemory(sessionId);
    await memory.saveContext(inputs, outputs);
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
   * 清理资源
   */
  async dispose(): Promise<void> {
    for (const [, messageHistory] of this.messageHistories) {
      await messageHistory.clear();
    }

    this.memories.clear();
    this.messageHistories.clear();
    this.listeners.length = 0;
  }
}
