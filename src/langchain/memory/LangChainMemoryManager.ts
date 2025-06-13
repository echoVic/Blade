/**
 * LangChain Memory Manager
 * 完全基于 LangChain 官方 memory 系统的实现
 */

import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  BaseMemory,
  BufferMemory,
  BufferWindowMemory,
  ChatMessageHistory,
  CombinedMemory,
  ConversationSummaryBufferMemory,
  ConversationSummaryMemory,
  ConversationTokenBufferMemory,
  EntityMemory,
  VectorStoreRetrieverMemory,
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
  type: 'buffer' | 'window' | 'summary' | 'token' | 'entity' | 'vector' | 'combined';
  options?: {
    // Buffer Window 配置
    k?: number; // 保留消息数量

    // Token Buffer 配置
    maxTokenLimit?: number;

    // Summary 配置
    maxTokenLimit?: number;

    // Vector Store 配置
    vectorStore?: any;
    retriever?: any;

    // Combined 配置
    memories?: BaseMemory[];
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
          maxTokenLimit: options.maxTokenLimit || 2000,
        });

      case 'token':
        return new ConversationTokenBufferMemory({
          chatHistory: messageHistory,
          returnMessages: true,
          memoryKey: 'chat_history',
          maxTokenLimit: options.maxTokenLimit || 2000,
        });

      case 'entity':
        return new EntityMemory({
          chatHistory: messageHistory,
          memoryKey: 'entities',
          entityExtractionPrompt: undefined, // 使用默认提示
          entitySummarizationPrompt: undefined, // 使用默认提示
        });

      case 'vector':
        if (!options.vectorStore) {
          throw new Error('Vector store is required for vector memory');
        }
        return new VectorStoreRetrieverMemory({
          vectorStoreRetriever: options.retriever || options.vectorStore.asRetriever(),
          memoryKey: 'chat_history',
        });

      case 'combined':
        const subMemories = options.memories || [
          new BufferMemory({
            chatHistory: messageHistory,
            memoryKey: 'chat_history',
          }),
          new EntityMemory({
            chatHistory: messageHistory,
            memoryKey: 'entities',
          }),
        ];

        return new CombinedMemory({
          memories: subMemories,
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

  async listSessions(userId?: string): Promise<string[]> {
    // 简化实现：返回当前活跃的会话列表
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
    const memory = await this.getOrCreateMemory(sessionId);
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
      // 其他类型记忆：作为系统消息存储，包含结构化数据
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
    const memory = await this.getOrCreateMemory(sessionId);
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

      if (msg instanceof SystemMessage && msg.content.startsWith('[')) {
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
            message: msg.content,
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

    // 利用 LangChain 的高级功能
    if (memory instanceof EntityMemory) {
      // 如果是实体记忆，获取提取的实体
      const variables = await memory.loadMemoryVariables({});
      if (variables.entities) {
        entries.push({
          id: `${sessionId}_entities`,
          sessionId,
          type: MemoryType.CONTEXT,
          content: {
            entities: variables.entities,
            extracted_at: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          importance: 0.8,
        });
      }
    }

    this.emitEvent({
      type: 'access',
      sessionId,
      timestamp: new Date(),
      data: { query, type, resultCount: entries.length },
    });

    return entries;
  }

  async forget(sessionId: string, entryId: string): Promise<void> {
    // LangChain 不支持选择性删除，这是一个设计限制
    console.warn('LangChain memory 不支持选择性删除单个条目');
    console.log('如需清空整个会话，请使用 deleteSession()');

    this.emitEvent({
      type: 'error',
      sessionId,
      entryId,
      timestamp: new Date(),
      error: 'LangChain memory 不支持选择性删除',
    });
  }

  async update(sessionId: string, entryId: string, updates: Partial<MemoryEntry>): Promise<void> {
    // LangChain 不支持直接更新，这是一个设计限制
    console.warn('LangChain memory 不支持直接更新条目');
    console.log('建议重新添加新的记忆条目');

    this.emitEvent({
      type: 'error',
      sessionId,
      entryId,
      timestamp: new Date(),
      error: 'LangChain memory 不支持直接更新',
    });
  }

  /**
   * 高级功能 - 利用 LangChain 的强大能力
   */
  async summarize(sessionId: string, maxEntries?: number): Promise<string> {
    const memory = await this.getOrCreateMemory(sessionId);

    // 如果是摘要类型的 memory，直接获取摘要
    if (
      memory instanceof ConversationSummaryMemory ||
      memory instanceof ConversationSummaryBufferMemory
    ) {
      const variables = await memory.loadMemoryVariables({});
      return variables.history || variables.summary || '暂无对话摘要';
    }

    // 对于其他类型，获取最近的对话
    const entries = await this.recall(sessionId, undefined, MemoryType.CONVERSATION);
    const recentEntries = entries.slice(-maxEntries || -50);

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

  async compress(sessionId: string): Promise<number> {
    const memory = await this.getOrCreateMemory(sessionId);

    // 对于支持自动压缩的 memory，触发压缩
    if (
      memory instanceof ConversationSummaryMemory ||
      memory instanceof ConversationTokenBufferMemory
    ) {
      const beforeCount = (await this.recall(sessionId)).length;

      // 重新加载 memory 变量会触发内部的压缩逻辑
      await memory.loadMemoryVariables({});

      const afterCount = (await this.recall(sessionId)).length;
      const compressed = Math.max(0, beforeCount - afterCount);

      this.emitEvent({
        type: 'cleanup',
        sessionId,
        timestamp: new Date(),
        data: { beforeCount, afterCount, compressed },
      });

      return compressed;
    }

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
    const memory = await this.getOrCreateMemory(sessionId);
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

    // 获取 LangChain memory 的特定统计
    const variables = await memory.loadMemoryVariables({});
    const memorySize = JSON.stringify(variables).length;

    return {
      sessionId,
      totalEntries: entries.length,
      totalSize: memorySize,
      entriesByType,
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      memoryType: this.config.type,
      langchainVariables: Object.keys(variables),
    } as MemoryStats & { memoryType: string; langchainVariables: string[] };
  }

  /**
   * 获取 LangChain memory 实例（用于高级操作）
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
    for (const [sessionId, messageHistory] of this.messageHistories) {
      await messageHistory.clear();
    }

    this.memories.clear();
    this.messageHistories.clear();
    this.listeners.length = 0;
  }
}
