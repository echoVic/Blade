/**
 * 模型工厂 - 统一创建和管理 LangChain 模型
 */

import { QwenChatModel } from './QwenChatModel.js';
import { VolcEngineChatModel } from './VolcEngineChatModel.js';
import type { BladeModelConfig, QwenModelConfig, VolcEngineModelConfig } from './types.js';

/**
 * 模型工厂类
 *
 * 提供统一的接口来创建和管理不同的 LLM 模型：
 * - 千问 (Qwen) 模型
 * - 火山引擎 (VolcEngine) 模型
 * - 模型配置验证
 * - 模型健康检查
 */
export class ModelFactory {
  private static instance: ModelFactory;
  private modelCache = new Map<string, QwenChatModel | VolcEngineChatModel>();

  /**
   * 获取工厂单例实例
   */
  static getInstance(): ModelFactory {
    if (!ModelFactory.instance) {
      ModelFactory.instance = new ModelFactory();
    }
    return ModelFactory.instance;
  }

  /**
   * 创建模型实例
   */
  createModel(config: BladeModelConfig): QwenChatModel | VolcEngineChatModel {
    const cacheKey = this.getCacheKey(config);

    // 检查缓存
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    let model: QwenChatModel | VolcEngineChatModel;

    switch (config.provider) {
      case 'qwen':
        model = new QwenChatModel(config.config as QwenModelConfig);
        break;

      case 'volcengine':
        model = new VolcEngineChatModel(config.config as VolcEngineModelConfig);
        break;

      default:
        throw new Error(`Unsupported model provider: ${config.provider}`);
    }

    // 缓存模型实例
    this.modelCache.set(cacheKey, model);

    return model;
  }

  /**
   * 创建千问模型
   */
  createQwenModel(config: QwenModelConfig): QwenChatModel {
    const bladeConfig: BladeModelConfig = {
      provider: 'qwen',
      config,
    };
    return this.createModel(bladeConfig) as QwenChatModel;
  }

  /**
   * 创建火山引擎模型
   */
  createVolcEngineModel(config: VolcEngineModelConfig): VolcEngineChatModel {
    const bladeConfig: BladeModelConfig = {
      provider: 'volcengine',
      config,
    };
    return this.createModel(bladeConfig) as VolcEngineChatModel;
  }

  /**
   * 验证配置
   */
  validateConfig(config: BladeModelConfig): boolean {
    if (!config.provider || !config.config) {
      return false;
    }

    const baseConfig = config.config;
    if (!baseConfig.apiKey) {
      return false;
    }

    switch (config.provider) {
      case 'qwen': {
        const qwenConfig = baseConfig as QwenModelConfig;
        return typeof qwenConfig.apiKey === 'string' && qwenConfig.apiKey.length > 0;
      }

      case 'volcengine': {
        const volcConfig = baseConfig as VolcEngineModelConfig;
        return typeof volcConfig.apiKey === 'string' && volcConfig.apiKey.length > 0;
      }

      default:
        return false;
    }
  }

  /**
   * 测试模型连接
   */
  async testModelConnection(config: BladeModelConfig): Promise<boolean> {
    try {
      if (!this.validateConfig(config)) {
        return false;
      }

      const model = this.createModel(config);
      return await model.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(config: BladeModelConfig): Promise<string[]> {
    try {
      const model = this.createModel(config);
      return await model.getModels();
    } catch (error) {
      throw new Error(`Failed to get available models: ${error}`);
    }
  }

  /**
   * 清除模型缓存
   */
  clearCache(): void {
    this.modelCache.clear();
  }

  /**
   * 清除指定配置的缓存
   */
  clearCacheForConfig(config: BladeModelConfig): void {
    const cacheKey = this.getCacheKey(config);
    this.modelCache.delete(cacheKey);
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(config: BladeModelConfig): string {
    const baseConfig = config.config;
    return `${config.provider}:${baseConfig.apiKey}:${baseConfig.model || 'default'}`;
  }

  /**
   * 获取支持的提供商列表
   */
  getSupportedProviders(): Array<'qwen' | 'volcengine'> {
    return ['qwen', 'volcengine'];
  }

  /**
   * 检查提供商是否支持
   */
  isProviderSupported(provider: string): provider is 'qwen' | 'volcengine' {
    return ['qwen', 'volcengine'].includes(provider);
  }
}

/**
 * 导出工厂实例（单例）
 */
export const modelFactory = ModelFactory.getInstance();
