/**
 * 配置服务 - 对接 @blade/core 配置系统
 * 负责读取所有配置文件和环境变量，然后调用 core 的 createConfig 函数
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createConfig, ConfigLayers, BladeUnifiedConfig } from '@blade-ai/core';

// 配置文件路径配置
const CONFIG_PATHS = {
  global: {
    userConfig: `${os.homedir()}/.blade/config.json`,
    userConfigLegacy: `${os.homedir()}/.blade-config.json`,
    trustedFolders: `${os.homedir()}/.blade/trusted-folders.json`,
  },
  project: {
    bladeConfig: './.blade/settings.local.json',
    packageJson: './package.json',
    bladeConfigRoot: './.blade/config.json',
  },
  env: {
    configFile: process.env.BLADE_CONFIG_FILE || '',
  },
};

/**
 * 配置服务类
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: BladeUnifiedConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * 初始化配置服务
   */
  async initialize(): Promise<BladeUnifiedConfig> {
    try {
      // 读取所有配置层的配置
      const layers = await this.loadAllConfigLayers();
      
      // 使用 core 包的 createConfig 函数合并配置
      const result = createConfig(layers, {
        validate: true,
        throwOnError: false,
      });

      if (result.errors.length > 0) {
        console.warn('配置验证警告:', result.errors.join(', '));
      }

      this.config = result.config;
      return this.config;

    } catch (error) {
      console.error('配置初始化失败:', error);
      
      // 返回默认配置
      const defaultResult = createConfig({}, { validate: false });
      this.config = defaultResult.config;
      return this.config;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): BladeUnifiedConfig {
    if (!this.config) {
      throw new Error('配置尚未初始化，请先调用 initialize() 方法');
    }
    return this.config;
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<BladeUnifiedConfig> {
    this.config = null;
    return this.initialize();
  }

  /**
   * 加载所有配置层
   */
  private async loadAllConfigLayers(): Promise<ConfigLayers> {
    const layers: ConfigLayers = {};

    try {
      // 加载全局配置
      layers.global = await this.loadGlobalConfig();
      
      // 加载环境变量配置
      layers.env = this.loadEnvConfig();
      
      // 加载用户配置
      layers.user = await this.loadUserConfig();
      
      // 加载项目配置
      layers.project = await this.loadProjectConfig();

    } catch (error) {
      console.warn('配置加载过程中出现错误:', error);
    }

    return layers;
  }

  /**
   * 加载全局配置
   */
  private async loadGlobalConfig(): Promise<any> {
    // 全局配置通常是硬编码的默认值
    return {
      auth: {
        // 基础认证
        apiKey: '',
        baseUrl: 'https://apis.iflow.cn/v1',
        
        // LLM 模型配置 (统一在auth下)
        modelName: 'Qwen3-Coder',
        temperature: 0.7,
        maxTokens: 4000,
        stream: true,
        
        // 高级参数
        topP: 0.9,
        topK: 50,
        frequencyPenalty: 0,
        presencePenalty: 0,
        
        // 其他
        searchApiKey: '',
        timeout: 30000,
      },
      ui: {
        theme: 'GitHub',
        hideTips: false,
        hideBanner: false,
      },
      security: {
        sandbox: 'docker',
        trustedFolders: [],
        allowedOperations: ['read', 'write', 'execute'],
      },
      // 其他默认配置...
    };
  }

  /**
   * 加载环境变量配置
   */
  private loadEnvConfig(): any {
    const envConfig: any = {};

    // 从环境变量读取配置
    if (process.env.BLADE_API_KEY) {
      envConfig.auth = { ...(envConfig.auth || {}), apiKey: process.env.BLADE_API_KEY };
    }
    if (process.env.BLADE_BASE_URL) {
      envConfig.auth = { ...(envConfig.auth || {}), baseUrl: process.env.BLADE_BASE_URL };
    }
    if (process.env.BLADE_MODEL) {
      envConfig.auth = { ...(envConfig.auth || {}), modelName: process.env.BLADE_MODEL };
    }
    if (process.env.BLADE_THEME) {
      envConfig.ui = { ...(envConfig.ui || {}), theme: process.env.BLADE_THEME };
    }

    return envConfig;
  }

  /**
   * 加载用户配置
   */
  private async loadUserConfig(): Promise<any> {
    try {
      const userConfigPath = CONFIG_PATHS.global.userConfig;
      const configContent = await fs.readFile(userConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      // 用户配置文件不存在或格式错误，返回空配置
      return {};
    }
  }

  /**
   * 加载项目配置
   */
  private async loadProjectConfig(): Promise<any> {
    try {
      const projectConfigPath = CONFIG_PATHS.project.bladeConfig;
      const configContent = await fs.readFile(projectConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      // 项目配置文件不存在或格式错误，返回空配置
      return {};
    }
  }

  /**
   * 保存用户配置
   */
  async saveUserConfig(config: any): Promise<void> {
    try {
      const userConfigPath = CONFIG_PATHS.global.userConfig;
      const configDir = path.dirname(userConfigPath);
      
      // 确保配置目录存在
      await fs.mkdir(configDir, { recursive: true });
      
      // 保存配置
      await fs.writeFile(userConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      
      // 重新加载配置
      await this.reload();
      
    } catch (error) {
      console.error('保存用户配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: any): Promise<BladeUnifiedConfig> {
    // 这里可以实现配置更新逻辑
    // 目前简单地重新加载配置
    return this.reload();
  }
}