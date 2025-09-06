/**
 * 上下文压缩器 - 智能压缩对话历史
 */

import type { ContextStrategy } from './LLMContextManager.js';
import type { LLMMessage } from './types.js';

export interface CompressionResult {
  originalMessages: LLMMessage[];
  compressedMessages: LLMMessage[];
  compressionRatio: number;
  preservedMessages: number;
  removedMessages: number;
  compressionStrategy: string;
}

export interface MessageImportance {
  message: LLMMessage;
  index: number;
  score: number;
  reasons: string[];
}

/**
 * 上下文压缩器
 */
export class ContextCompressor {
  private isInitialized = false;

  /**
   * 初始化压缩器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('初始化上下文压缩器...');
    this.isInitialized = true;
    this.log('上下文压缩器初始化完成');
  }

  /**
   * 销毁压缩器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.log('销毁上下文压缩器...');
    this.isInitialized = false;
    this.log('上下文压缩器已销毁');
  }

  /**
   * 压缩上下文
   */
  public async compressContext(
    messages: LLMMessage[],
    retentionRules: ContextStrategy['retentionRules']
  ): Promise<LLMMessage[]> {
    if (!this.isInitialized) {
      throw new Error('上下文压缩器未初始化');
    }

    if (messages.length <= retentionRules.keepRecentMessages) {
      return messages; // 无需压缩
    }

    try {
      this.log(`开始压缩上下文，原始消息数: ${messages.length}`);

      // 1. 分析消息重要性
      const messageImportance = this.analyzeMessageImportance(messages);

      // 2. 应用保留规则
      const preservedMessages = this.applyRetentionRules(messageImportance, retentionRules);

      // 3. 生成压缩摘要（如果需要）
      const compressedMessages = await this.generateCompressedSummary(
        messages,
        preservedMessages,
        retentionRules
      );

      this.log(`上下文压缩完成，压缩后消息数: ${compressedMessages.length}`);

      return compressedMessages;
    } catch (error) {
      this.error('上下文压缩失败', error);
      throw error;
    }
  }

  /**
   * 分析消息重要性
   */
  private analyzeMessageImportance(messages: LLMMessage[]): MessageImportance[] {
    return messages.map((message, index) => {
      let score = 0;
      const reasons: string[] = [];

      // 系统消息重要性最高
      if (message.role === 'system') {
        score += 100;
        reasons.push('系统消息');
      }

      // 最近消息重要性较高
      const recencyBonus = Math.max(0, ((messages.length - index) / messages.length) * 20);
      score += recencyBonus;
      if (recencyBonus > 15) {
        reasons.push('最近消息');
      }

      // 消息长度影响重要性
      if (message.content.length > 500) {
        score += 10;
        reasons.push('详细内容');
      } else if (message.content.length < 50) {
        score -= 5;
        reasons.push('简短内容');
      }

      // 关键词重要性
      const keywordScore = this.calculateKeywordImportance(message.content);
      score += keywordScore;
      if (keywordScore > 5) {
        reasons.push('包含关键词');
      }

      // 问答对重要性
      if (message.role === 'user' && index < messages.length - 1) {
        const nextMessage = messages[index + 1];
        if (nextMessage.role === 'assistant') {
          score += 15;
          reasons.push('问答对');
        }
      }

      // 代码相关消息重要性
      if (this.containsCode(message.content)) {
        score += 15;
        reasons.push('包含代码');
      }

      return {
        message,
        index,
        score: Math.max(0, score),
        reasons,
      };
    });
  }

  /**
   * 计算关键词重要性
   */
  private calculateKeywordImportance(content: string): number {
    const lowerContent = content.toLowerCase();
    let score = 0;

    // 重要关键词
    const importantKeywords = [
      '错误',
      'error',
      'bug',
      '问题',
      'issue',
      '实现',
      'implement',
      '解决',
      'solve',
      '配置',
      'config',
      '设置',
      'setting',
      'API',
      'api',
      '接口',
      'interface',
      '数据库',
      'database',
      '数据',
      'data',
    ];

    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 2;
      }
    }

    return score;
  }

  /**
   * 检查是否包含代码
   */
  private containsCode(content: string): boolean {
    // 简单的代码检测规则
    const codeIndicators = [
      '```', // 代码块
      'function',
      'class',
      'const',
      'let',
      'var', // JavaScript关键词
      'def ',
      'import ',
      'from ', // Python关键词
      '{',
      '}',
      '()',
      '=>', // 常见代码符号
      'console.log',
      'print(', // 常见函数调用
    ];

    return codeIndicators.some(indicator => content.includes(indicator));
  }

  /**
   * 应用保留规则
   */
  private applyRetentionRules(
    messageImportance: MessageImportance[],
    retentionRules: ContextStrategy['retentionRules']
  ): LLMMessage[] {
    const preservedMessages: LLMMessage[] = [];
    const sortedByImportance = [...messageImportance].sort((a, b) => b.score - a.score);

    // 1. 保留系统消息
    if (retentionRules.keepSystemMessages) {
      for (const item of messageImportance) {
        if (item.message.role === 'system') {
          preservedMessages.push(item.message);
        }
      }
    }

    // 2. 保留最近消息
    const recentMessages = messageImportance
      .slice(-retentionRules.keepRecentMessages)
      .map(item => item.message);

    for (const message of recentMessages) {
      if (!preservedMessages.includes(message)) {
        preservedMessages.push(message);
      }
    }

    // 3. 保留重要消息
    if (retentionRules.keepImportantMessages) {
      const importantMessages = sortedByImportance
        .slice(0, Math.floor(messageImportance.length * 0.3)) // 保留前30%重要消息
        .map(item => item.message);

      for (const message of importantMessages) {
        if (!preservedMessages.includes(message)) {
          preservedMessages.push(message);
        }
      }
    }

    // 按原始顺序排序
    return preservedMessages.sort((a, b) => {
      const indexA = messageImportance.find(item => item.message === a)?.index || 0;
      const indexB = messageImportance.find(item => item.message === b)?.index || 0;
      return indexA - indexB;
    });
  }

  /**
   * 生成压缩摘要
   */
  private async generateCompressedSummary(
    originalMessages: LLMMessage[],
    preservedMessages: LLMMessage[],
    retentionRules: ContextStrategy['retentionRules']
  ): Promise<LLMMessage[]> {
    const removedMessages = originalMessages.filter(msg => !preservedMessages.includes(msg));

    if (removedMessages.length === 0) {
      return preservedMessages;
    }

    // 生成被移除消息的摘要
    const summary = this.generateMessageSummary(removedMessages);

    if (summary.trim()) {
      // 在保留消息的开头插入摘要
      const summaryMessage: LLMMessage = {
        role: 'system',
        content: `[上下文摘要] ${summary}`,
      };

      // 找到第一个非系统消息的位置
      const firstNonSystemIndex = preservedMessages.findIndex(msg => msg.role !== 'system');

      if (firstNonSystemIndex === -1) {
        preservedMessages.push(summaryMessage);
      } else {
        preservedMessages.splice(firstNonSystemIndex, 0, summaryMessage);
      }
    }

    return preservedMessages;
  }

  /**
   * 生成消息摘要
   */
  private generateMessageSummary(messages: LLMMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    const summaryParts: string[] = [];

    // 按角色分组统计
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    if (userMessages.length > 0) {
      summaryParts.push(`用户提出了${userMessages.length}个问题`);

      // 提取主要话题
      const topics = this.extractTopics(userMessages.map(m => m.content));
      if (topics.length > 0) {
        summaryParts.push(`主要涉及: ${topics.slice(0, 3).join('、')}`);
      }
    }

    if (assistantMessages.length > 0) {
      summaryParts.push(`助手提供了${assistantMessages.length}个回答`);
    }

    return summaryParts.join('，');
  }

  /**
   * 提取话题
   */
  private extractTopics(contents: string[]): string[] {
    const allContent = contents.join(' ').toLowerCase();
    const topics: string[] = [];

    // 预定义话题关键词
    const topicKeywords = {
      代码开发: ['代码', 'code', '编程', '开发', '实现'],
      问题解决: ['错误', 'error', 'bug', '问题', '解决'],
      配置设置: ['配置', 'config', '设置', 'setting'],
      文档说明: ['文档', '说明', '教程', '指南'],
      测试验证: ['测试', 'test', '验证', '检查'],
      性能优化: ['优化', '性能', '改进', '重构'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => allContent.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * 获取压缩统计信息
   */
  public getCompressionStats(): {
    totalCompressions: number;
    averageCompressionRatio: number;
    totalMessagesSaved: number;
  } {
    // 这里应该记录压缩历史，暂时返回模拟数据
    return {
      totalCompressions: 0,
      averageCompressionRatio: 0.6,
      totalMessagesSaved: 0,
    };
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: unknown): void {
    console.log(`[ContextCompressor] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: unknown): void {
    console.error(`[ContextCompressor] ${message}`, error || '');
  }
}
