/**
 * LLM模型路由器 - 智能选择最适合的模型
 */

import { EventEmitter } from 'events';
import type { BladeConfig } from '../config/types/index.js';
import type { LLMMessage, LLMRequest, LLMResponse } from './types.js';

export interface ModelDefinition {
  name: string;
  provider: string;
  capabilities: string[];
  contextWindow: number;
  costPerToken: number;
  speedRating: number; // 1-10
  qualityRating: number; // 1-10
  specializations: string[];
}

export interface ModelSelection {
  model: ModelDefinition;
  reason: string;
  confidence: number;
  alternatives: ModelDefinition[];
}

export interface ModelPerformance {
  modelName: string;
  averageResponseTime: number;
  errorRate: number;
  qualityScore: number;
  totalCalls: number;
  lastUsed: number;
}

/**
 * LLM模型路由器
 */
export class LLMModelRouter extends EventEmitter {
  private config: BladeConfig;
  private isInitialized = false;
  private availableModels = new Map<string, ModelDefinition>();
  private modelPerformance = new Map<string, ModelPerformance>();
  private defaultModel?: ModelDefinition;

  constructor(config: BladeConfig) {
    super();
    this.config = config;
  }

  /**
   * 初始化模型路由器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log('初始化LLM模型路由器...');

      // 注册可用模型
      await this.registerAvailableModels();

      // 设置默认模型
      this.setDefaultModel();

      this.isInitialized = true;
      this.log('LLM模型路由器初始化完成');
      this.emit('initialized');
    } catch (error) {
      this.error('LLM模型路由器初始化失败', error);
      throw error;
    }
  }

  /**
   * 销毁模型路由器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.log('销毁LLM模型路由器...');
    this.availableModels.clear();
    this.modelPerformance.clear();
    this.defaultModel = undefined;
    this.isInitialized = false;
    this.removeAllListeners();
    this.log('LLM模型路由器已销毁');
  }

  /**
   * 智能选择模型
   */
  public async selectModel(messages: LLMMessage[]): Promise<ModelDefinition> {
    if (!this.isInitialized) {
      throw new Error('LLM模型路由器未初始化');
    }

    try {
      // 1. 分析任务特征
      const taskFeatures = this.analyzeTaskFeatures(messages);

      // 2. 计算每个模型的适配分数
      const modelScores = new Map<string, number>();

      for (const [modelName, model] of this.availableModels) {
        const score = this.calculateModelScore(model, taskFeatures, messages);
        modelScores.set(modelName, score);
      }

      // 3. 选择最佳模型
      let bestModel = this.defaultModel;
      let bestScore = 0;

      for (const [modelName, score] of modelScores) {
        if (score > bestScore) {
          bestScore = score;
          bestModel = this.availableModels.get(modelName);
        }
      }

      if (!bestModel) {
        throw new Error('未找到可用的模型');
      }

      this.log(`选择模型: ${bestModel.name} (得分: ${bestScore.toFixed(2)})`);
      return bestModel;
    } catch (error) {
      this.error('模型选择失败', error);
      throw error;
    }
  }

  /**
   * 调用模型
   */
  public async callModel(model: ModelDefinition, messages: LLMMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // 构造请求
      const request: LLMRequest = {
        messages,
        apiKey: this.config.apiKey || '',
        baseUrl: this.config.baseUrl || 'https://apis.iflow.cn/v1',
        modelName: model.name,
        temperature: this.getOptimalTemperature(messages),
        maxTokens: this.getOptimalMaxTokens(model, messages),
      };

      // 执行API调用
      const response = await this.executeAPICall(request);

      // 记录性能数据
      const executionTime = Date.now() - startTime;
      this.recordModelPerformance(model.name, executionTime, true, response);

      return response;
    } catch (error) {
      // 记录失败性能数据
      const executionTime = Date.now() - startTime;
      this.recordModelPerformance(model.name, executionTime, false);
      throw error;
    }
  }

  /**
   * 分析任务特征
   */
  private analyzeTaskFeatures(messages: LLMMessage[]): string[] {
    const features: string[] = [];
    const allContent = messages
      .map(m => m.content)
      .join(' ')
      .toLowerCase();

    // 分析内容特征
    if (allContent.includes('代码') || allContent.includes('code') || allContent.includes('编程')) {
      features.push('coding');
    }

    if (allContent.includes('分析') || allContent.includes('analysis')) {
      features.push('analysis');
    }

    if (allContent.includes('创意') || allContent.includes('creative')) {
      features.push('creative');
    }

    if (allContent.includes('翻译') || allContent.includes('translate')) {
      features.push('translation');
    }

    if (allContent.includes('数学') || allContent.includes('计算') || allContent.includes('math')) {
      features.push('mathematical');
    }

    // 分析消息特征
    if (messages.length > 10) {
      features.push('long_conversation');
    }

    if (messages.some(m => m.content.length > 1000)) {
      features.push('long_content');
    }

    return features;
  }

  /**
   * 计算模型适配分数
   */
  private calculateModelScore(
    model: ModelDefinition,
    taskFeatures: string[],
    messages: LLMMessage[]
  ): number {
    let score = 0;

    // 基础质量分数
    score += model.qualityRating * 10;

    // 专业化匹配分数
    for (const feature of taskFeatures) {
      if (model.specializations.includes(feature)) {
        score += 20;
      } else if (model.capabilities.includes(feature)) {
        score += 10;
      }
    }

    // 上下文窗口适配性
    const estimatedTokens = this.estimateTokenCount(messages);
    if (estimatedTokens <= model.contextWindow * 0.8) {
      score += 15;
    } else if (estimatedTokens <= model.contextWindow) {
      score += 5;
    } else {
      score -= 30; // 超出上下文窗口严重扣分
    }

    // 性能表现加成
    const performance = this.modelPerformance.get(model.name);
    if (performance) {
      // 响应速度加成
      score += Math.max(0, (5000 - performance.averageResponseTime) / 100);

      // 错误率惩罚
      score -= performance.errorRate * 50;

      // 质量分数加成
      score += performance.qualityScore * 10;
    }

    // 成本效益考虑
    if (taskFeatures.includes('simple')) {
      score += 10 - model.costPerToken * 1000; // 简单任务偏向低成本模型
    }

    return Math.max(0, score);
  }

  /**
   * 获取最优温度参数
   */
  private getOptimalTemperature(messages: LLMMessage[]): number {
    const allContent = messages
      .map(m => m.content)
      .join(' ')
      .toLowerCase();

    // 代码相关任务使用低温度
    if (allContent.includes('代码') || allContent.includes('code') || allContent.includes('实现')) {
      return 0.1;
    }

    // 创意任务使用高温度
    if (
      allContent.includes('创意') ||
      allContent.includes('brainstorm') ||
      allContent.includes('想法')
    ) {
      return 0.8;
    }

    // 分析任务使用中等温度
    if (allContent.includes('分析') || allContent.includes('解释')) {
      return 0.3;
    }

    // 默认温度
    return 0.7;
  }

  /**
   * 获取最优最大token数
   */
  private getOptimalMaxTokens(model: ModelDefinition, messages: LLMMessage[]): number {
    const inputTokens = this.estimateTokenCount(messages);
    const availableTokens = model.contextWindow - inputTokens;

    // 保留一定的安全边距
    return Math.max(512, Math.min(4096, Math.floor(availableTokens * 0.8)));
  }

  /**
   * 执行API调用
   */
  private async executeAPICall(request: LLMRequest): Promise<LLMResponse> {
    const apiUrl = `${request.baseUrl!.replace(/\/$/, '')}/chat/completions`;

    const payload = {
      model: request.modelName,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2048,
      stream: request.stream || false,
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.apiKey}`,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(request.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('响应格式错误');
    }

    return {
      content: data.choices[0].message.content || '',
      usage: data.usage,
      model: data.model,
    };
  }

  /**
   * 记录模型性能
   */
  private recordModelPerformance(
    modelName: string,
    executionTime: number,
    success: boolean,
    response?: LLMResponse
  ): void {
    let performance = this.modelPerformance.get(modelName);

    if (!performance) {
      performance = {
        modelName,
        averageResponseTime: executionTime,
        errorRate: success ? 0 : 1,
        qualityScore: 0.8, // 默认质量分数
        totalCalls: 1,
        lastUsed: Date.now(),
      };
    } else {
      // 更新平均响应时间
      performance.averageResponseTime =
        (performance.averageResponseTime * performance.totalCalls + executionTime) /
        (performance.totalCalls + 1);

      // 更新错误率
      const errorCount = performance.errorRate * performance.totalCalls + (success ? 0 : 1);
      performance.errorRate = errorCount / (performance.totalCalls + 1);

      // 更新调用次数和最后使用时间
      performance.totalCalls++;
      performance.lastUsed = Date.now();

      // 根据响应质量调整质量分数（简化实现）
      if (success && response) {
        const responseLength = response.content.length;
        if (responseLength > 100 && responseLength < 5000) {
          performance.qualityScore = Math.min(1.0, performance.qualityScore + 0.01);
        }
      }
    }

    this.modelPerformance.set(modelName, performance);
  }

  /**
   * 注册可用模型
   */
  private async registerAvailableModels(): Promise<void> {
    // 注册内置模型定义
    const models: ModelDefinition[] = [
      {
        name: 'Qwen3-Coder',
        provider: 'iflow',
        capabilities: ['coding', 'analysis', 'general'],
        contextWindow: 8192,
        costPerToken: 0.001,
        speedRating: 8,
        qualityRating: 9,
        specializations: ['coding', 'technical_writing'],
      },
      {
        name: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        capabilities: ['coding', 'analysis', 'creative', 'reasoning'],
        contextWindow: 200000,
        costPerToken: 0.003,
        speedRating: 7,
        qualityRating: 10,
        specializations: ['complex_reasoning', 'code_analysis'],
      },
      {
        name: 'gpt-4o',
        provider: 'openai',
        capabilities: ['general', 'coding', 'analysis', 'creative'],
        contextWindow: 128000,
        costPerToken: 0.005,
        speedRating: 6,
        qualityRating: 9,
        specializations: ['multimodal', 'general_purpose'],
      },
    ];

    for (const model of models) {
      this.availableModels.set(model.name, model);
      this.log(`注册模型: ${model.name}`);
    }
  }

  /**
   * 设置默认模型
   */
  private setDefaultModel(): void {
    // 优先使用配置中指定的模型
    const configModelName = this.config.modelName;
    if (configModelName && this.availableModels.has(configModelName)) {
      this.defaultModel = this.availableModels.get(configModelName);
      this.log(`设置默认模型: ${configModelName}`);
      return;
    }

    // 否则选择第一个可用模型
    const firstModel = Array.from(this.availableModels.values())[0];
    if (firstModel) {
      this.defaultModel = firstModel;
      this.log(`设置默认模型: ${firstModel.name}`);
    }
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
   * 注册新模型
   */
  public registerModel(model: ModelDefinition): void {
    this.availableModels.set(model.name, model);
    this.log(`注册新模型: ${model.name}`);
    this.emit('modelRegistered', model);
  }

  /**
   * 获取模型信息
   */
  public getModel(name: string): ModelDefinition | undefined {
    return this.availableModels.get(name);
  }

  /**
   * 获取所有模型
   */
  public getAllModels(): ModelDefinition[] {
    return Array.from(this.availableModels.values());
  }

  /**
   * 获取模型性能数据
   */
  public getModelPerformance(name: string): ModelPerformance | undefined {
    return this.modelPerformance.get(name);
  }

  /**
   * 获取所有性能数据
   */
  public getAllPerformanceData(): ModelPerformance[] {
    return Array.from(this.modelPerformance.values());
  }

  /**
   * 获取推荐模型
   */
  public getRecommendedModels(taskType: string): ModelDefinition[] {
    return Array.from(this.availableModels.values())
      .filter(
        model => model.specializations.includes(taskType) || model.capabilities.includes(taskType)
      )
      .sort((a, b) => b.qualityRating - a.qualityRating);
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const models = Array.from(this.availableModels.values());
    const performances = Array.from(this.modelPerformance.values());

    return {
      totalModels: models.length,
      totalCalls: performances.reduce((sum, p) => sum + p.totalCalls, 0),
      averageResponseTime:
        performances.length > 0
          ? performances.reduce((sum, p) => sum + p.averageResponseTime, 0) / performances.length
          : 0,
      overallErrorRate:
        performances.length > 0
          ? performances.reduce((sum, p) => sum + p.errorRate, 0) / performances.length
          : 0,
      modelDistribution: this.getModelUsageDistribution(),
    };
  }

  /**
   * 获取模型使用分布
   */
  private getModelUsageDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const [modelName, performance] of this.modelPerformance) {
      distribution[modelName] = performance.totalCalls;
    }

    return distribution;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: unknown): void {
    console.log(`[LLMModelRouter] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: unknown): void {
    console.error(`[LLMModelRouter] ${message}`, error || '');
  }
}
