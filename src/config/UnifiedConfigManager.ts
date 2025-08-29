/**
 * Blade 统一配置管理器
 * 基于新的分层配置系统，提供向后兼容的接口
 */

import { ConfigurationManager } from '@blade-ai/core';
import { BladeUnifiedConfig, BladeConfig } from './types.unified.js';

/**
 * 统一配置管理器
 * 提供向后兼容的接口，同时使用新的分层配置系统
 */
export class UnifiedConfigManager {
  private configManager: ConfigurationManager;
  private unifiedConfig: BladeUnifiedConfig | null = null;

  constructor() {
    this.configManager = new ConfigurationManager();
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    try {
      this.unifiedConfig = await this.configManager.initialize();
    } catch (error) {
      console.error('配置初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置（向后兼容接口）
   */
  getConfig(): BladeConfig {
    if (!this.unifiedConfig) {
      throw new Error('配置尚未初始化');
    }

    // 转换为扁平化配置格式以保持向后兼容
    return this.toFlatConfig(this.unifiedConfig);
  }

  /**
   * 更新配置（向后兼容接口）
   */
  async updateConfig(updates: Partial<BladeConfig>): Promise<void> {
    if (!this.unifiedConfig) {
      throw new Error('配置尚未初始化');
    }

    // 转换为分层配置格式
    const layeredUpdates = this.fromFlatConfig(updates);
    await this.configManager.updateConfig(layeredUpdates);
    this.unifiedConfig = this.configManager.getConfig();
  }

  /**
   * 获取配置值
   */
  get(key: string): any {
    if (!this.unifiedConfig) {
      throw new Error('配置尚未初始化');
    }

    return this.getConfigValue(this.unifiedConfig, key);
  }

  /**
   * 设置配置值
   */
  async set(key: string, value: any): Promise<void> {
    if (!this.unifiedConfig) {
      throw new Error('配置尚未初始化');
    }

    const updates: any = {};
    this.setConfigValue(updates, key, value);
    
    const layeredUpdates = this.fromFlatConfig(updates);
    await this.configManager.updateConfig(layeredUpdates);
    this.unifiedConfig = this.configManager.getConfig();
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<BladeConfig> {
    this.unifiedConfig = await this.configManager.reload();
    return this.getConfig();
  }

  /**
   * 获取配置状态
   */
  getState() {
    return this.configManager.getState();
  }

  /**
   * 启用热重载
   */
  enableHotReload(): void {
    this.configManager.enable();
  }

  /**
   * 禁用热重载
   */
  disableHotReload(): void {
    this.configManager.disable();
  }

  /**
   * 订阅配置变更事件
   */
  subscribe(callback: (config: BladeConfig) => void): () => void {
    return this.configManager.subscribe((event) => {
      if (this.unifiedConfig) {
        callback(this.toFlatConfig(this.unifiedConfig));
      }
    });
  }

  /**
   * 转换为扁平化配置（向后兼容）
   */
  private toFlatConfig(config: BladeUnifiedConfig): BladeConfig {
    return {
      // 认证配置
      apiKey: config.auth.apiKey,
      baseUrl: config.auth.baseUrl,
      modelName: config.auth.modelName,
      searchApiKey: config.auth.searchApiKey,
      timeout: config.auth.timeout,
      maxTokens: config.auth.maxTokens,
      temperature: config.auth.temperature,
      stream: config.auth.stream,
      
      // UI 配置
      theme: config.ui.theme,
      hideTips: config.ui.hideTips,
      hideBanner: config.ui.hideBanner,
      outputFormat: config.ui.outputFormat,
      
      // 安全配置
      sandbox: config.security.sandbox,
      
      // 工具配置
      toolDiscoveryCommand: config.tools.toolDiscoveryCommand,
      toolCallCommand: config.tools.toolCallCommand,
      summarizeToolOutput: config.tools.summarizeToolOutput,
      
      // MCP 配置
      mcpServers: config.mcp.mcpServers,
      
      // 遥测配置
      telemetry: config.telemetry,
      
      // 使用配置
      usageStatisticsEnabled: config.usage.usageStatisticsEnabled,
      maxSessionTurns: config.usage.maxSessionTurns,
      
      // 调试配置
      debug: config.debug.debug,
    };
  }

  /**
   * 从扁平化配置转换（向后兼容）
   */
  private fromFlatConfig(config: Partial<BladeConfig>): Partial<BladeUnifiedConfig> {
    const result: Partial<BladeUnifiedConfig> = {};
    
    // 处理认证配置
    if ('apiKey' in config || 'baseUrl' in config || 'modelName' in config || 
        'searchApiKey' in config || 'timeout' in config || 'maxTokens' in config ||
        'temperature' in config || 'stream' in config) {
      result.auth = {};
      if (config.apiKey !== undefined) result.auth.apiKey = config.apiKey;
      if (config.baseUrl !== undefined) result.auth.baseUrl = config.baseUrl;
      if (config.modelName !== undefined) result.auth.modelName = config.modelName;
      if (config.searchApiKey !== undefined) result.auth.searchApiKey = config.searchApiKey;
      if (config.timeout !== undefined) result.auth.timeout = config.timeout;
      if (config.maxTokens !== undefined) result.auth.maxTokens = config.maxTokens;
      if (config.temperature !== undefined) result.auth.temperature = config.temperature;
      if (config.stream !== undefined) result.auth.stream = config.stream;
    }
    
    // 处理 UI 配置
    if ('theme' in config || 'hideTips' in config || 'hideBanner' in config || 'outputFormat' in config) {
      result.ui = {};
      if (config.theme !== undefined) result.ui.theme = config.theme;
      if (config.hideTips !== undefined) result.ui.hideTips = config.hideTips;
      if (config.hideBanner !== undefined) result.ui.hideBanner = config.hideBanner;
      if (config.outputFormat !== undefined) result.ui.outputFormat = config.outputFormat;
    }
    
    // 处理安全配置
    if (config.sandbox !== undefined) {
      result.security = { sandbox: config.sandbox };
    }
    
    // 处理工具配置
    if ('toolDiscoveryCommand' in config || 'toolCallCommand' in config || 'summarizeToolOutput' in config) {
      result.tools = {};
      if (config.toolDiscoveryCommand !== undefined) result.tools.toolDiscoveryCommand = config.toolDiscoveryCommand;
      if (config.toolCallCommand !== undefined) result.tools.toolCallCommand = config.toolCallCommand;
      if (config.summarizeToolOutput !== undefined) result.tools.summarizeToolOutput = config.summarizeToolOutput;
    }
    
    // 处理 MCP 配置
    if (config.mcpServers !== undefined) {
      result.mcp = { mcpServers: config.mcpServers };
    }
    
    // 处理遥测配置
    if (config.telemetry !== undefined) {
      result.telemetry = config.telemetry;
    }
    
    // 处理使用配置
    if ('usageStatisticsEnabled' in config || 'maxSessionTurns' in config) {
      result.usage = {};
      if (config.usageStatisticsEnabled !== undefined) result.usage.usageStatisticsEnabled = config.usageStatisticsEnabled;
      if (config.maxSessionTurns !== undefined) result.usage.maxSessionTurns = config.maxSessionTurns;
    }
    
    // 处理调试配置
    if (config.debug !== undefined) {
      result.debug = { debug: config.debug };
    }
    
    return result;
  }

  /**
   * 获取配置值（支持嵌套路径）
   */
  private getConfigValue(config: any, path: string): any {
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, config);
  }

  /**
   * 设置配置值（支持嵌套路径）
   */
  private setConfigValue(config: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}