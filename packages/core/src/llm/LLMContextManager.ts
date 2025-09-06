/**
 * LLM上下文管理器
 * 负责上下文压缩、历史管理和智能路由
 */

import { EventEmitter } from 'events';
import type { BladeConfig } from '../config/types/index.js';
import { ContextCompressor } from './ContextCompressor.js';
// import { LLMModelRouter } from './LLMModelRouter.js';
import type { LLMMessage, LLMResponse } from './types.js';

export interface ContextWindow {
  messages: LLMMessage[];
  tokenCount: number;
  maxTokens: number;
  compressionLevel: number;
}

export interface ConversationSession {
  id: string;
  messages: LLMMessage[];
  metadata: {
    createdAt: number;
    lastUpdated: number;
    totalTokensUsed: number;
    messageCount: number;
    compressionCount: number;
  };
}

export interface ContextStrategy {
  maxMessages: number;
  maxTokens: number;
  compressionThreshold: number;
  retentionRules: {
    keepSystemMessages: boolean;
    keepRecentMessages: number;
    keepImportantMessages: boolean;
  };
}

/**
 * LLM上下文管理器
 */
export class LLMContextManager extends EventEmitter {
  private config: BladeConfig;
  // private modelRouter: LLMModelRouter;
  private contextCompressor: ContextCompressor;
  private isInitialized = false;

  // 会话管理
  private sessions = new Map<string, ConversationSession>();
  private currentSessionId?: string;

  // 上下文策略
  private contextStrategy: ContextStrategy = {
    maxMessages: 50,
    maxTokens: 8000,
    compressionThreshold: 6000,
    retentionRules: {
      keepSystemMessages: true,
      keepRecentMessages: 10,
      keepImportantMessages: true,
    },
  };

  constructor(config: BladeConfig) {
    super();
    this.config = config;
    // this.modelRouter = new LLMModelRouter(config);
    this.contextCompressor = new ContextCompressor();
  }

  /**
   * 初始化上下文管理器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log('初始化LLM上下文管理器...');

      // await this.modelRouter.initialize();
      await this.contextCompressor.initialize();

      this.isInitialized = true;
      this.log('LLM上下文管理器初始化完成');
      this.emit('initialized');
    } catch (error) {
      this.error('LLM上下文管理器初始化失败', error);
      throw error;
    }
  }

  /**
   * 销毁上下文管理器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.log('销毁LLM上下文管理器...');

      // await this.modelRouter.destroy();
      await this.contextCompressor.destroy();

      this.sessions.clear();
      this.currentSessionId = undefined;
      this.isInitialized = false;
      this.removeAllListeners();

      this.log('LLM上下文管理器已销毁');
    } catch (error) {
      this.error('LLM上下文管理器销毁失败', error);
      throw error;
    }
  }

  /**
   * 处理对话 - 智能上下文管理
   */
  public async processConversation(messages: LLMMessage[], sessionId?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('LLM上下文管理器未初始化');
    }

    // 调试信息：检查配置
    this.log('处理对话请求，配置信息:', {
      apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 10)}...` : '未设置',
      baseUrl: this.config.baseUrl,
      modelName: this.config.modelName,
    });

    try {
      // 1. 获取或创建会话
      const session = this.getOrCreateSession(sessionId);

      // 2. 添加新消息到会话
      session.messages.push(...messages);
      session.metadata.lastUpdated = Date.now();
      session.metadata.messageCount = session.messages.length;

      // 3. 检查是否需要上下文压缩
      const contextWindow = await this.prepareContextWindow(session);

      // 4. 选择最佳模型 (TODO: 实现)
      // const selectedModel = await this.modelRouter.selectModel(contextWindow.messages);

      // 5. 执行LLM调用 - 使用LLMManager进行实际调用
      const llmManager = new (await import('./LLMManager.js')).LLMManager({
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        modelName: this.config.modelName,
      });
      const actualResponse = await llmManager.conversation(contextWindow.messages);

      const response: LLMResponse = {
        content: actualResponse,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, // TODO: 实际token计算
      };

      // 6. 添加响应到会话
      session.messages.push({
        role: 'assistant',
        content: response.content,
      });

      // 7. 更新会话元数据
      this.updateSessionMetadata(session, response);

      this.emit('conversationProcessed', {
        sessionId: session.id,
        messageCount: messages.length,
        responseTokens: response.usage?.completionTokens || 0,
      });

      return response.content;
    } catch (error) {
      this.error('处理对话失败', error);
      throw error;
    }
  }

  /**
   * 获取或创建会话
   */
  private getOrCreateSession(sessionId?: string): ConversationSession {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const newSessionId = sessionId || this.generateSessionId();
    const session: ConversationSession = {
      id: newSessionId,
      messages: [],
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        totalTokensUsed: 0,
        messageCount: 0,
        compressionCount: 0,
      },
    };

    this.sessions.set(newSessionId, session);
    this.currentSessionId = newSessionId;

    this.log(`创建新会话: ${newSessionId}`);
    return session;
  }

  /**
   * 准备上下文窗口
   */
  private async prepareContextWindow(session: ConversationSession): Promise<ContextWindow> {
    let messages = [...session.messages];
    let tokenCount = this.estimateTokenCount(messages);

    // 检查是否需要压缩
    if (tokenCount > this.contextStrategy.compressionThreshold) {
      this.log(
        `上下文超出阈值(${tokenCount} > ${this.contextStrategy.compressionThreshold})，开始压缩...`
      );

      messages = await this.contextCompressor.compressContext(
        messages,
        this.contextStrategy.retentionRules
      );

      tokenCount = this.estimateTokenCount(messages);
      session.metadata.compressionCount++;

      this.log(`上下文压缩完成，token数量: ${tokenCount}`);
      this.emit('contextCompressed', {
        sessionId: session.id,
        originalTokens: this.estimateTokenCount(session.messages),
        compressedTokens: tokenCount,
      });
    }

    return {
      messages,
      tokenCount,
      maxTokens: this.contextStrategy.maxTokens,
      compressionLevel: session.metadata.compressionCount,
    };
  }

  /**
   * 更新会话元数据
   */
  private updateSessionMetadata(session: ConversationSession, response: LLMResponse): void {
    if (response.usage) {
      session.metadata.totalTokensUsed += response.usage.totalTokens;
    }
    session.metadata.lastUpdated = Date.now();
    session.metadata.messageCount = session.messages.length;
  }

  /**
   * 估算token数量 - 简化实现
   */
  private estimateTokenCount(messages: LLMMessage[]): number {
    return messages.reduce((total, message) => {
      // 粗略估算：中文1个字符≈1个token，英文1个单词≈1.3个token
      const chineseChars = (message.content.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = (message.content.match(/[a-zA-Z]+/g) || []).length;
      return total + chineseChars + Math.ceil(englishWords * 1.3);
    }, 0);
  }

  /**
   * 创建新会话
   */
  public createSession(sessionId?: string): string {
    const id = sessionId || this.generateSessionId();
    this.getOrCreateSession(id);
    return id;
  }

  /**
   * 切换会话
   */
  public switchSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false;
    }

    this.currentSessionId = sessionId;
    this.log(`切换到会话: ${sessionId}`);
    return true;
  }

  /**
   * 获取会话信息
   */
  public getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取当前会话
   */
  public getCurrentSession(): ConversationSession | undefined {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
  }

  /**
   * 删除会话
   */
  public deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.log(`删除会话: ${sessionId}`);
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = undefined;
      }
    }
    return deleted;
  }

  /**
   * 获取所有会话ID
   */
  public getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 清理过期会话
   */
  public cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.metadata.lastUpdated > maxAge) {
        this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.log(`清理了${cleanedCount}个过期会话`);
    }

    return cleanedCount;
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const sessions = Array.from(this.sessions.values());
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0);
    const totalTokens = sessions.reduce((sum, s) => sum + s.metadata.totalTokensUsed, 0);
    const totalCompressions = sessions.reduce((sum, s) => sum + s.metadata.compressionCount, 0);

    return {
      totalSessions,
      totalMessages,
      totalTokens,
      totalCompressions,
      averageMessagesPerSession: totalSessions > 0 ? totalMessages / totalSessions : 0,
      averageTokensPerSession: totalSessions > 0 ? totalTokens / totalSessions : 0,
      contextStrategy: { ...this.contextStrategy },
    };
  }

  /**
   * 更新上下文策略
   */
  public updateContextStrategy(strategy: Partial<ContextStrategy>): void {
    this.contextStrategy = { ...this.contextStrategy, ...strategy };
    this.log('上下文策略已更新', this.contextStrategy);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: unknown): void {
    console.log(`[LLMContextManager] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: unknown): void {
    console.error(`[LLMContextManager] ${message}`, error || '');
  }
}
