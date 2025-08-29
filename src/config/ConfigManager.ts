/**
 * Blade 配置管理器 (向后兼容封装)
 * 基于新的统一配置管理器，保持原有接口不变
 */

import { UnifiedConfigManager } from './UnifiedConfigManager.js';
import type { BladeConfig } from './types.js';

export class ConfigManager {
  private unifiedManager: UnifiedConfigManager;
  private config: BladeConfig;

  constructor() {
    this.unifiedManager = new UnifiedConfigManager();
    this.config = {} as BladeConfig;
    this.loadConfiguration();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      await this.unifiedManager.initialize();
      this.config = this.unifiedManager.getConfig();
    } catch (error) {
      console.warn('配置加载失败，使用默认配置:', error);
      // 保持原有默认配置加载逻辑作为降级方案
      this.loadDefaultConfiguration();
    }
  }

  private loadDefaultConfiguration(): void {
    // 原有的默认配置加载逻辑
    const { DEFAULT_CONFIG, ENV_MAPPING } = require('./defaults.js');
    this.config = { ...DEFAULT_CONFIG } as BladeConfig;
    
    // 加载环境变量
    this.loadFromEnvironment();
  }

  private loadFromEnvironment(): void {
    const { ENV_MAPPING } = require('./defaults.js');
    for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        (this.config as any)[configKey] = value;
      }
    }
  }

  async getConfig(): Promise<BladeConfig> {
    try {
      this.config = this.unifiedManager.getConfig();
      return { ...this.config };
    } catch (error) {
      console.warn('获取最新配置失败，返回缓存配置:', error);
      return { ...this.config };
    }
  }

  async updateConfig(updates: Partial<BladeConfig>): Promise<void> {
    try {
      await this.unifiedManager.updateConfig(updates);
      this.config = this.unifiedManager.getConfig();
    } catch (error) {
      console.error('配置更新失败:', error);
      throw error;
    }
  }

  async get(key: keyof BladeConfig): Promise<any> {
    try {
      return this.unifiedManager.get(key as string);
    } catch (error) {
      console.warn(`获取配置项 ${String(key)} 失败，返回缓存值:`, error);
      return this.config[key];
    }
  }

  async set(key: keyof BladeConfig, value: any): Promise<void> {
    try {
      await this.unifiedManager.set(key as string, value);
      this.config = this.unifiedManager.getConfig();
    } catch (error) {
      console.error(`设置配置项 ${String(key)} 失败:`, error);
      throw error;
    }
  }

  async reload(): Promise<BladeConfig> {
    try {
      const reloadedConfig = await this.unifiedManager.reload();
      this.config = reloadedConfig;
      return { ...this.config };
    } catch (error) {
      console.error('重新加载配置失败:', error);
      throw error;
    }
  }

  enableHotReload(): void {
    try {
      this.unifiedManager.enableHotReload();
    } catch (error) {
      console.warn('启用热重载失败:', error);
    }
  }

  disableHotReload(): void {
    try {
      this.unifiedManager.disableHotReload();
    } catch (error) {
      console.warn('禁用热重载失败:', error);
    }
  }

  subscribe(callback: (config: BladeConfig) => void): () => void {
    try {
      return this.unifiedManager.subscribe(callback);
    } catch (error) {
      console.warn('订阅配置变更失败:', error);
      return () => {};
    }
  }
}