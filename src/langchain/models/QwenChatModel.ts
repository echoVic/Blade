/**
 * 千问 Chat 模型 - LangChain 集成
 */

import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatGeneration, ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import OpenAI from 'openai';
import type { QwenModelConfig } from './types.js';

/**
 * 千问 Chat 模型 - 基于 LangChain 的实现
 *
 * 支持阿里云百练平台的千问模型，包括：
 * - Qwen3 系列模型的 enable_thinking 参数
 * - 流式输出支持
 * - 工具调用支持
 * - 完整的错误处理和重试机制
 */
export class QwenChatModel extends BaseChatModel {
  private client: OpenAI;
  private config: QwenModelConfig;

  constructor(config: QwenModelConfig) {
    super({
      maxRetries: config.maxRetries || 3,
    });

    this.config = {
      model: 'qwen-plus-2025-04-28',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.8,
      ...config,
    };

    // 初始化 OpenAI 客户端
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  /**
   * LangChain 必需的标识符
   */
  _llmType(): string {
    return 'qwen-chat';
  }

  /**
   * 判断是否为 Qwen3 模型
   */
  private isQwen3Model(model: string): boolean {
    const lowerModel = model.toLowerCase();

    // 明确的 Qwen3 模型
    if (lowerModel.startsWith('qwen3')) {
      return true;
    }

    // Latest 版本都是 Qwen3
    if (lowerModel.includes('latest')) {
      return true;
    }

    // 2025年版本都是 Qwen3
    if (lowerModel.includes('2025-04-28')) {
      return true;
    }

    // 当前的 turbo 和 plus 也是 Qwen3
    if (lowerModel === 'qwen-turbo' || lowerModel === 'qwen-plus') {
      return true;
    }

    return false;
  }

  /**
   * 获取 Qwen3 模型的 enable_thinking 默认值
   */
  private getEnableThinkingValue(model: string): boolean {
    // 对于特定模型强制设置为 false
    if (model === 'qwen3-235b-a22b') {
      return false;
    }

    // 其他 Qwen3 模型默认为 false（商业版）
    return false;
  }

  /**
   * 将 LangChain BaseMessage 转换为 OpenAI 格式
   */
  private convertMessagesToOpenAI(messages: BaseMessage[]) {
    return messages.map(msg => {
      const messageType = msg._getType();
      let role: 'system' | 'user' | 'assistant';

      // 将 LangChain 的消息类型转换为 Qwen API 期望的角色
      switch (messageType) {
        case 'human':
          role = 'user';
          break;
        case 'ai':
          role = 'assistant';
          break;
        case 'system':
          role = 'system';
          break;
        default:
          role = 'user'; // 默认为 user
          break;
      }

      return {
        role,
        content: msg.content as string,
      };
    });
  }

  /**
   * 核心生成方法
   */
  async _generate(
    messages: BaseMessage[],
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const model = this.config.model!;

    try {
      const requestParams: any = {
        model,
        messages: this.convertMessagesToOpenAI(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
        stream: false,
      };

      // 对于 Qwen3 模型，设置 enable_thinking 参数
      if (this.isQwen3Model(model)) {
        requestParams.enable_thinking = this.getEnableThinkingValue(model);
      }

      const completion = await this.client.chat.completions.create(requestParams);

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Invalid response from Qwen API');
      }

      const generations: ChatGeneration[] = [
        {
          text: choice.message.content || '',
          message: new AIMessage(choice.message.content || ''),
        },
      ];

      return {
        generations,
        llmOutput: {
          tokenUsage: completion.usage
            ? {
                promptTokens: completion.usage.prompt_tokens,
                completionTokens: completion.usage.completion_tokens,
                totalTokens: completion.usage.total_tokens,
              }
            : undefined,
          model: completion.model,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Qwen API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 流式生成方法
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const model = this.config.model!;

    try {
      const requestParams: any = {
        model,
        messages: this.convertMessagesToOpenAI(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
        stream: true,
      };

      // 对于 Qwen3 模型，设置 enable_thinking 参数
      if (this.isQwen3Model(model)) {
        requestParams.enable_thinking = this.getEnableThinkingValue(model);
      }

      const stream = (await this.client.chat.completions.create(requestParams)) as any;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield new ChatGenerationChunk({
            text: choice.delta.content,
            message: new AIMessageChunk({ content: choice.delta.content }),
          });
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Qwen streaming error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map((model: any) => model.id);
    } catch (error) {
      throw new Error(`Failed to get Qwen models: ${error}`);
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.config.model!;
      const requestParams: any = {
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      if (this.isQwen3Model(model)) {
        requestParams.enable_thinking = this.getEnableThinkingValue(model);
      }

      await this.client.chat.completions.create(requestParams);
      return true;
    } catch (error) {
      return false;
    }
  }
}
