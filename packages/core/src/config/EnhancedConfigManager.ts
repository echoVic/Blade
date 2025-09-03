/**
 * 增强版配置管理器，集成错误处理
 */

import { ConfigManager } from '../config/ConfigManager.js';
import { 
  ErrorFactory, 
  globalErrorMonitor,
  ConfigError
} from '../error/index.js';
import type { BladeConfig } from './types/index.js';

/**
 * 错误监控配置接口
 */
export interface ErrorMonitoringConfig {
  enabled: boolean;
  sampleRate: number;
  maxErrorsPerMinute: number;
  excludePatterns: string[];
  includePatterns: string[];
  autoReport: boolean;
  storeReports: boolean;
  maxStoredReports: number;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
}

/**
 * 增强版配置管理器，集成错误处理
 */
export class EnhancedConfigManager extends ConfigManager {
  private errorMonitoringConfig: ErrorMonitoringConfig;
  private configLoadStats = {
    totalLoads: 0,
    successfulLoads: 0,
    failedLoads: 0,
    lastError: undefined as string | undefined
  };

  constructor() {
    super();
    
    // 从配置中获取错误监控设置
    this.errorMonitoringConfig = this.initializeErrorMonitoringConfig();
    
    // 配置全局错误监控器
    if (this.errorMonitoringConfig.enabled) {
      this.configureGlobalErrorMonitor();
    }
  }

  private initializeErrorMonitoringConfig(): ErrorMonitoringConfig {
    const config = this.getConfig();
    return {
      enabled: true,
      sampleRate: 1.0,
      maxErrorsPerMinute: 100,
      excludePatterns: [],
      includePatterns: [],
      autoReport: false,
      storeReports: true,
      maxStoredReports: 1000,
      enableConsole: config.debug ?? true,
      enableFile: false,
      logFilePath: undefined
    };
  }

  private configureGlobalErrorMonitor(): void {
    // 配置全局错误监控器（如果有相关API）
    try {
      // 这里可以添加全局错误监控器的配置逻辑
      if (this.errorMonitoringConfig.enableConsole) {
        console.info('[配置] 错误监控已启用');
      }
    } catch (error) {
      console.warn('配置错误监控器失败:', error);
    }
  }

  /**
   * 重写更新配置方法，添加错误处理
   */
  public updateConfig(updates: Partial<BladeConfig>): void {
    this.configLoadStats.totalLoads++;
    
    try {
      // 验证配置更新
      this.validateConfigUpdates(updates);
      
      // 调用父类方法
      super.updateConfig(updates);
      
      // 更新错误监控配置
       this.errorMonitoringConfig = this.initializeErrorMonitoringConfig();
      
      this.configLoadStats.successfulLoads++;
      
      if (this.errorMonitoringConfig.enableConsole) {
        console.info('[配置] 配置更新成功');
      }
    } catch (error) {
      this.configLoadStats.failedLoads++;
      this.configLoadStats.lastError = error instanceof Error ? error.message : String(error);
      
      const configError = error instanceof Error 
        ? ErrorFactory.fromNativeError(error, '配置更新失败')
        : new ConfigError('CONFIG_SAVE_FAILED', '配置更新失败');
      
      globalErrorMonitor.monitor(configError);
      
      // 如果是关键配置更新失败，抛出错误
      if (this.isCriticalConfigUpdate(updates)) {
        throw configError;
      }
      
      console.warn(`[警告] 配置更新失败: ${configError.message}`);
    }
  }

  /**
   * 重写重载配置方法，添加错误处理
   */
  public async reload(): Promise<BladeConfig> {
    this.configLoadStats.totalLoads++;
    
    try {
      const config = await super.reload();
      
      // 更新错误监控配置
       this.errorMonitoringConfig = this.initializeErrorMonitoringConfig();
      
      this.configLoadStats.successfulLoads++;
      
      if (this.errorMonitoringConfig.enableConsole) {
        console.info('[配置] 配置重载成功');
      }
      
      return config;
    } catch (error) {
      this.configLoadStats.failedLoads++;
      this.configLoadStats.lastError = error instanceof Error ? error.message : String(error);
      
      const configError = error instanceof Error 
        ? ErrorFactory.fromNativeError(error, '配置重载失败')
        : new ConfigError('CONFIG_LOAD_FAILED', '配置重载失败');
      
      globalErrorMonitor.monitor(configError);
      throw configError;
    }
  }

  /**
   * 验证配置更新
   */
  private validateConfigUpdates(updates: Partial<BladeConfig>): void {
    const errors: string[] = [];
    
    // 验证 API Key
    if (updates.apiKey !== undefined) {
      if (typeof updates.apiKey !== 'string' || updates.apiKey.trim() === '') {
        errors.push('API Key 必须是非空字符串');
      }
    }
    
    // 验证 Base URL
    if (updates.baseUrl !== undefined) {
      if (typeof updates.baseUrl !== 'string' || updates.baseUrl.trim() === '') {
        errors.push('Base URL 必须是非空字符串');
      } else {
        try {
          new URL(updates.baseUrl);
        } catch {
          errors.push('Base URL 格式无效');
        }
      }
    }
    
    // 验证模型名称
    if (updates.modelName !== undefined) {
      if (typeof updates.modelName !== 'string' || updates.modelName.trim() === '') {
        errors.push('模型名称必须是非空字符串');
      }
    }
    
    if (errors.length > 0) {
      throw new ConfigError('CONFIG_VALIDATION_FAILED', `配置验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 判断是否为关键配置更新
   */
  private isCriticalConfigUpdate(updates: Partial<BladeConfig>): boolean {
    const criticalKeys = ['apiKey', 'baseUrl', 'modelName'];
    return Object.keys(updates).some(key => criticalKeys.includes(key));
  }

  /**
   * 获取配置加载统计信息
   */
  public getConfigLoadStats(): {
    totalLoads: number;
    successfulLoads: number;
    failedLoads: number;
    lastError?: string;
  } {
    return { ...this.configLoadStats };
  }

  /**
   * 获取错误监控配置
   */
  public getErrorMonitoringConfig(): ErrorMonitoringConfig {
    return { ...this.errorMonitoringConfig };
  }

  /**
   * 更新错误监控配置
   */
  public updateErrorMonitoringConfig(config: Partial<ErrorMonitoringConfig>): void {
    this.errorMonitoringConfig = {
      ...this.errorMonitoringConfig,
      ...config
    };
    
    if (this.errorMonitoringConfig.enabled) {
      this.configureGlobalErrorMonitor();
    }
  }

  /**
   * 重置配置加载统计
   */
  public resetConfigLoadStats(): void {
    this.configLoadStats = {
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      lastError: undefined
    };
  }
}