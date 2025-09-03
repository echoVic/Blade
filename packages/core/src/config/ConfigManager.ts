/**
 * Blade 配置管理器 (简化版本)
 * 提供基础的配置管理功能
 */

import { ConfigError, ErrorFactory, globalErrorMonitor } from '../error/index.js';
import type { BladeConfig } from './types/index.js';
import { DEFAULT_CONFIG, ENV_MAPPING } from './defaults.js';

export class ConfigManager {
  private config: BladeConfig;
  private subscribers: Array<(config: BladeConfig) => void> = [];

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadFromEnvironment();
  }

  private loadFromEnvironment(): void {
    try {
      for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
        const envValue = process.env[envKey];
        if (envValue) {
          (this.config as any)[configKey] = this.parseEnvValue(envValue);
        }
      }
    } catch (error) {
      const bladeError =
        error instanceof Error
          ? ErrorFactory.fromNativeError(error, '环境变量加载失败')
          : new ConfigError('CONFIG_LOAD_FAILED', '环境变量加载失败');

      globalErrorMonitor.monitor(bladeError);
      console.warn('环境变量加载失败，使用默认配置:', error);
    }
  }

  private parseEnvValue(value: string): any {
    // 尝试解析布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // 尝试解析数字
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;

    // 返回字符串
    return value;
  }

  public getConfig(): BladeConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<BladeConfig>): void {
    try {
      this.config = { ...this.config, ...updates };
      this.notifySubscribers();
    } catch (error) {
      const bladeError =
        error instanceof Error
          ? ErrorFactory.fromNativeError(error, '配置更新失败')
          : new ConfigError('CONFIG_LOAD_FAILED', '配置更新失败');

      globalErrorMonitor.monitor(bladeError);
      throw bladeError;
    }
  }

  public async get(key: keyof BladeConfig): Promise<any> {
    return this.config[key];
  }

  public async set(key: keyof BladeConfig, value: any): Promise<void> {
    try {
      (this.config as any)[key] = value;
      this.notifySubscribers();
    } catch (error) {
      const bladeError =
        error instanceof Error
          ? ErrorFactory.fromNativeError(error, '配置设置失败')
          : new ConfigError('CONFIG_LOAD_FAILED', '配置设置失败');

      globalErrorMonitor.monitor(bladeError);
      throw bladeError;
    }
  }

  public async reload(): Promise<BladeConfig> {
    try {
      this.config = { ...DEFAULT_CONFIG };
      this.loadFromEnvironment();
      this.notifySubscribers();
      return this.getConfig();
    } catch (error) {
      const bladeError =
        error instanceof Error
          ? ErrorFactory.fromNativeError(error, '配置重载失败')
          : new ConfigError('CONFIG_LOAD_FAILED', '配置重载失败');

      globalErrorMonitor.monitor(bladeError);
      throw bladeError;
    }
  }

  public enableHotReload(): void {
    // 简化版本暂不支持热重载
    console.warn('热重载功能在简化版本中不可用');
  }

  public disableHotReload(): void {
    // 简化版本暂不支持热重载
  }

  public subscribe(callback: (config: BladeConfig) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private notifySubscribers(): void {
    const config = this.getConfig();
    this.subscribers.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('配置订阅回调执行失败:', error);
      }
    });
  }

  private validateConfig(config: Partial<BladeConfig>): any[] {
    const errors: any[] = [];

    // 基础验证
    if (config.apiKey !== undefined && typeof config.apiKey !== 'string') {
      errors.push({ path: 'apiKey', message: 'API Key 必须是字符串' });
    }

    if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') {
      errors.push({ path: 'baseUrl', message: 'Base URL 必须是字符串' });
    }

    if (config.modelName !== undefined && typeof config.modelName !== 'string') {
      errors.push({ path: 'modelName', message: 'Model Name 必须是字符串' });
    }

    return errors;
  }

  private validateConfigValue(key: keyof BladeConfig, value: any): any[] {
    const errors: any[] = [];

    switch (key) {
      case 'apiKey':
      case 'baseUrl':
      case 'modelName':
      case 'searchApiKey':
        if (value !== undefined && typeof value !== 'string') {
          errors.push({ path: key, message: `${key} 必须是字符串` });
        }
        break;
      case 'maxSessionTurns':
        if (value !== undefined && (typeof value !== 'number' || value < 1)) {
          errors.push({ path: key, message: `${key} 必须是大于0的数字` });
        }
        break;
      case 'debug':
      case 'hideTips':
      case 'hideBanner':
      case 'usageStatisticsEnabled':
        if (value !== undefined && typeof value !== 'boolean') {
          errors.push({ path: key, message: `${key} 必须是布尔值` });
        }
        break;
    }

    return errors;
  }
}
