/**
 * 平铺配置LLM管理器
 * 直接映射到极简三要素配置
 */

import type { BladeConfig } from '../config/types/index.js';
import { ErrorFactory, LLMError, NetworkError, globalRetryManager } from '../error/index.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

/**
 * 平铺配置LLM管理器
 * 核心职责：用平铺三要素(apiKey, baseUrl, modelName)直接驱动模型
 */
export class LLMManager {
  private config: Partial<LLMRequest> = {};

  constructor(config: Pick<BladeConfig, 'apiKey' | 'baseUrl' | 'modelName'>) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://apis.iflow.cn/v1',
      modelName: config.modelName || 'Qwen3-Coder',
    };
  }

  /**
   * 设置配置
   */
  configure(config: Partial<LLMRequest>) {
    Object.assign(this.config, config);
  }

  /**
   * 基础调用
   */
  async send(request: Partial<LLMRequest>): Promise<LLMResponse> {
    const config = { ...this.config, ...request };

    // 验证必要配置
    if (!config.apiKey) {
      throw ErrorFactory.createLLMError('API_KEY_MISSING', 'API密钥未配置');
    }
    if (!config.baseUrl) {
      throw ErrorFactory.createLLMError('BASE_URL_MISSING', 'Base URL未配置');
    }
    if (!config.modelName) {
      throw ErrorFactory.createLLMError('MODEL_NAME_MISSING', '模型名称未配置');
    }
    if (!config.messages) {
      throw ErrorFactory.createLLMError('REQUEST_FAILED', '消息内容不能为空');
    }

    // 构造请求
    const payload = {
      model: config.modelName,
      messages: config.messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2048,
      stream: config.stream || false,
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };

    // 使用重试管理器执行API调用
    return globalRetryManager.execute(async () => {
      try {
        // 智能构造API URL
        const baseUrl = config.baseUrl!.replace(/\/$/, '');
        let apiUrl: string;

        // 如果base URL已经包含了chat/completions，直接使用
        if (baseUrl.includes('/chat/completions')) {
          apiUrl = baseUrl;
        }
        // 如果base URL以/v1结尾，添加/chat/completions
        else if (baseUrl.endsWith('/v1')) {
          apiUrl = `${baseUrl}/chat/completions`;
        }
        // 否则，尝试添加/v1/chat/completions (标准OpenAI格式)
        else {
          apiUrl = `${baseUrl}/v1/chat/completions`;
        }

        console.log('[LLMManager] Base URL:', baseUrl);
        console.log('[LLMManager] 最终API URL:', apiUrl);
        console.log('[LLMManager] 请求负载:', JSON.stringify(payload, null, 2));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(config.timeout || 30000),
        });

        if (!response.ok) {
          throw ErrorFactory.createHttpError(response.status, config.baseUrl!, response.statusText);
        }

        const data = await response.json();

        // 添加详细的响应调试信息
        console.log('[LLMManager] API响应数据:', JSON.stringify(data, null, 2));

        // 尝试解析不同的响应格式
        let content = '';

        // 标准 OpenAI 格式
        if (data.choices && data.choices[0] && data.choices[0].message) {
          content = data.choices[0].message.content || '';
        }
        // 一些其他API可能直接返回content
        else if (data.content) {
          content = data.content;
        }
        // 或者返回text字段
        else if (data.text) {
          content = data.text;
        }
        // 或者返回response字段
        else if (data.response) {
          content = data.response;
        }
        // 如果是错误响应
        else if (data.error) {
          throw ErrorFactory.createLLMError(
            'API_ERROR',
            `API错误: ${data.error.message || data.error}`
          );
        }
        // 检查是否是API Key无效的特殊错误格式
        else if (data.status && data.msg) {
          // 处理 iflow.cn API 的特殊错误格式
          if (data.status === '434' || data.msg.includes('Invalid apiKey')) {
            throw ErrorFactory.createLLMError(
              'API_KEY_INVALID',
              `API Key无效: ${data.msg}\n\n请按以下步骤配置API Key:\n1. 访问 ${data.msg.includes('iflow.cn') ? 'https://iflow.cn/' : '相应的API服务商网站'} 获取API Key\n2. 设置环境变量: export BLADE_API_KEY="your-api-key"\n3. 重新启动 Blade`
            );
          }
          throw ErrorFactory.createLLMError('API_ERROR', `API错误 (${data.status}): ${data.msg}`);
        } else {
          console.error('[LLMManager] 无法解析响应格式，实际收到:', data);
          throw ErrorFactory.createLLMError(
            'RESPONSE_PARSE_ERROR',
            `无法解析响应格式: ${JSON.stringify(data)}`
          );
        }

        return {
          content,
          usage: data.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          model: data.model || config.modelName,
        };
      } catch (error) {
        if (error instanceof LLMError || error instanceof NetworkError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw ErrorFactory.createTimeoutError('LLM API调用', config.timeout || 30000);
        }

        throw ErrorFactory.fromNativeError(error as Error, 'LLM调用失败');
      }
    }, 'LLM_API_CALL');
  }

  /**
   * 快速对话
   */
  async chat(message: string): Promise<string> {
    return await this.send({ messages: [{ role: 'user', content: message }] }).then(r => r.content);
  }

  /**
   * 系统对话
   */
  async chatWithSystem(systemPrompt: string, userMessage: string): Promise<string> {
    return await this.send({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }).then(r => r.content);
  }

  /**
   * 多轮对话
   */
  async conversation(messages: LLMMessage[]): Promise<string> {
    return await this.send({ messages }).then(r => r.content);
  }
}
