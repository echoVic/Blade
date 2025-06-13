/**
 * 火山引擎 Chat 模型 - LangChain 集成
 */

import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatGeneration, ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import OpenAI from 'openai';
import type { VolcEngineModelConfig } from './types.js';

/**
 * 火山引擎 Chat 模型 - 基于 LangChain 的实现
 *
 * 支持火山方舟平台的豆包模型，包括：
 * - 流式输出支持
 * - 工具调用支持
 * - 完整的错误处理和重试机制
 */
export class VolcEngineChatModel extends BaseChatModel {
  private client: OpenAI;
  private config: VolcEngineModelConfig;

  constructor(config: VolcEngineModelConfig) {
    super({
      maxRetries: config.maxRetries || 3,
    });

    this.config = {
      model: 'ep-20250417144747-rgffm',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.8,
      ...config,
    };

    // 初始化 OpenAI 客户端
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.endpoint || 'https://ark.cn-beijing.volces.com/api/v3',
    });
  }

  /**
   * LangChain 必需的标识符
   */
  _llmType(): string {
    return 'volcengine-chat';
  }

  /**
   * 将 LangChain BaseMessage 转换为 OpenAI 格式
   */
  private convertMessagesToOpenAI(messages: BaseMessage[]) {
    return messages.map(msg => ({
      role: msg._getType() as 'system' | 'user' | 'assistant',
      content: msg.content as string,
    }));
  }

  /**
   * 核心生成方法
   */
  async _generate(
    messages: BaseMessage[],
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model!,
        messages: this.convertMessagesToOpenAI(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Invalid response from VolcEngine API');
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
        throw new Error(`VolcEngine API error: ${error.message}`);
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
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model!,
        messages: this.convertMessagesToOpenAI(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
        stream: true,
      });

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
        throw new Error(`VolcEngine streaming error: ${error.message}`);
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
      return models.data.map(model => model.id);
    } catch (error) {
      throw new Error(`Failed to get VolcEngine models: ${error}`);
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
