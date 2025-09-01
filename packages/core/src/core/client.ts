import { Agent } from './agent/Agent.js';
import type { BladeConfig } from './config/types.js';
import type { LLMProvider } from './llm/types.js';

export class BladeClient {
  private agent: Agent | null = null;
  private config: BladeConfig;
  private initialized = false;

  constructor(config: BladeConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 初始化Agent
      this.agent = new Agent({
        llm: {
          provider: this.config.llm.provider as LLMProvider,
          model: this.config.llm.model,
          apiKey: this.config.auth.apiKey,
        },
        config: this.config,
      });

      await this.agent.init();
      
      this.initialized = true;
      console.log('Blade客户端初始化完成');
    } catch (error) {
      console.error('Blade客户端初始化失败:', error);
      throw error;
    }
  }

  public async chat(message: string): Promise<string> {
    if (!this.initialized || !this.agent) {
      throw new Error('客户端未初始化');
    }

    try {
      const response = await this.agent.chat(message);
      return response;
    } catch (error) {
      console.error('聊天请求失败:', error);
      throw error;
    }
  }

  public async generateCode(prompt: string): Promise<string> {
    if (!this.initialized || !this.agent) {
      throw new Error('客户端未初始化');
    }

    try {
      const code = await this.agent.generateCode(prompt);
      return code;
    } catch (error) {
      console.error('代码生成失败:', error);
      throw error;
    }
  }

  public async executeTool(toolName: string, params: any): Promise<any> {
    if (!this.initialized || !this.agent) {
      throw new Error('客户端未初始化');
    }

    try {
      const result = await this.agent.executeTool(toolName, params);
      return result;
    } catch (error) {
      console.error(`工具执行失败 (${toolName}):`, error);
      throw error;
    }
  }

  public async analyzeFiles(filePaths: string[]): Promise<any> {
    if (!this.initialized || !this.agent) {
      throw new Error('客户端未初始化');
    }

    try {
      const analysis = await this.agent.analyzeFiles(filePaths);
      return analysis;
    } catch (error) {
      console.error('文件分析失败:', error);
      throw error;
    }
  }

  public async getAgent(): Promise<Agent> {
    if (!this.initialized || !this.agent) {
      throw new Error('客户端未初始化');
    }
    return this.agent;
  }

  public getConfig(): BladeConfig {
    return this.config;
  }

  public async destroy(): Promise<void> {
    if (this.agent) {
      await this.agent.destroy();
      this.agent = null;
    }
    this.initialized = false;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // 静态工厂方法
  public static async create(config: BladeConfig): Promise<BladeClient> {
    const client = new BladeClient(config);
    await client.initialize();
    return client;
  }
}