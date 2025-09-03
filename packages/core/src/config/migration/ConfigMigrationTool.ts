/**
 * Blade 配置迁移工具
 * 支持从旧版本配置迁移到新版本配置系统
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  BladeConfig, 
  CONFIG_PATHS 
} from '../types/index.js';
import {
  UserConfig,
  ProjectConfig,
  UserConfigSchema,
  ProjectConfigSchema
} from '../types/schemas.js';

/**
 * 迁移版本定义
 */
export interface MigrationVersion {
  from: string;
  to: string;
  description: string;
  migrator: (config: any) => any;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  changes: string[];
  warnings: string[];
  errors: string[];
  backupPath?: string;
}

/**
 * 迁移工具选项
 */
export interface MigrationOptions {
  createBackup?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  targetVersion?: string;
}

/**
 * 配置迁移工具
 */
export class ConfigMigrationTool {
  private migrations: MigrationVersion[] = [];
  private readonly backupDir: string;

  constructor() {
    this.backupDir = path.join(os.homedir(), '.blade', 'backups');
    this.registerMigrations();
  }

  /**
   * 注册迁移规则
   */
  private registerMigrations(): void {
    // 从 v1.0.0 迁移到 v1.1.0：扁平化到分层结构
    this.migrations.push({
      from: '1.0.0',
      to: '1.1.0',
      description: '从扁平化配置迁移到分层配置结构',
      migrator: this.migrateFromV1ToV1_1,
    });

    // 从 v1.1.0 迁移到 v1.2.0：添加安全性配置
    this.migrations.push({
      from: '1.1.0',
      to: '1.2.0',
      description: '添加安全性和扩展配置支持',
      migrator: this.migrateFromV1_1ToV1_2,
    });

    // 从 v1.2.0 迁移到 v1.3.0：完善遥测和使用配置
    this.migrations.push({
      from: '1.2.0',
      to: '1.3.0',
      description: '完善遥测和使用配置结构',
      migrator: this.migrateFromV1_2ToV1_3,
    });
  }

  /**
   * 迁移用户配置
   */
  async migrateUserConfig(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      createBackup = true,
      dryRun = false,
      verbose = false,
      force = false,
      targetVersion = '1.3.0',
    } = options;

    const result: MigrationResult = {
      success: false,
      fromVersion: 'unknown',
      toVersion: targetVersion,
      changes: [],
      warnings: [],
      errors: [],
    };

    try {
      // 检查配置文件是否存在
      const configPath = CONFIG_PATHS.global.userConfig;
      const exists = await this.fileExists(configPath);

      if (!exists) {
        result.errors.push('用户配置文件不存在');
        return result;
      }

      // 读取现有配置
      const configContent = await fs.readFile(configPath as string, 'utf-8');
      const config = JSON.parse(configContent);

      // 检测版本
      const currentVersion = config.version || '1.0.0';
      result.fromVersion = currentVersion;

      if (verbose) {
        console.log(`当前配置版本: ${currentVersion}`);
        console.log(`目标版本: ${targetVersion}`);
      }

      // 检查是否需要迁移
      if (currentVersion === targetVersion) {
        result.success = true;
        result.warnings.push('配置已是最新版本，无需迁移');
        return result;
      }

      if (!force && !this.shouldMigrate(currentVersion, targetVersion)) {
        result.errors.push('配置版本不支持降级迁移');
        return result;
      }

      // 创建备份
      if (createBackup && !dryRun) {
        const backupPath = await this.createBackup(configPath, currentVersion);
        result.backupPath = backupPath;
        if (verbose) {
          console.log(`备份已创建: ${backupPath}`);
        }
      }

      // 执行迁移
      const migrationChain = this.getMigrationChain(currentVersion, targetVersion);
      let migratedConfig = config;

      for (const migration of migrationChain) {
        if (verbose) {
          console.log(`执行迁移: ${migration.description}`);
        }

        try {
          migratedConfig = migration.migrator(migratedConfig);
          result.changes.push(migration.description);
          
          if (verbose) {
            console.log(`迁移完成: ${migration.from} -> ${migration.to}`);
          }
        } catch (error) {
          result.errors.push(`迁移失败: ${migration.description} - ${error}`);
          return result;
        }
      }

      // 设置版本
      migratedConfig.version = targetVersion;
      migratedConfig.lastUpdated = new Date().toISOString();

      // 验证迁移后的配置
      const validationResult = this.validateUserConfig(migratedConfig);
      if (!validationResult.valid) {
        result.errors.push(...validationResult.errors);
        return result;
      }

      result.warnings.push(...validationResult.warnings);

      // 保存新配置
      if (!dryRun) {
        await this.saveUserConfig(migratedConfig);
        if (verbose) {
          console.log('用户配置迁移完成');
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.push(`迁移过程发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
      return result;
    }
  }

  /**
   * 迁移项目配置
   */
  async migrateProjectConfig(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      createBackup = true,
      dryRun = false,
      verbose = false,
      force = false,
      targetVersion = '1.3.0',
    } = options;

    const result: MigrationResult = {
      success: false,
      fromVersion: 'unknown',
      toVersion: targetVersion,
      changes: [],
      warnings: [],
      errors: [],
    };

    try {
      // 检查项目配置文件
      const configPath = CONFIG_PATHS.project.bladeConfig;
      const exists = await this.fileExists(configPath);

      if (!exists) {
        result.warnings.push('项目配置文件不存在，跳过迁移');
        result.success = true;
        return result;
      }

      // 读取现有配置
      const configContent = await fs.readFile(configPath as string, 'utf-8');
      const config = JSON.parse(configContent);

      // 检测版本
      const currentVersion = config.version || '1.0.0';
      result.fromVersion = currentVersion;

      if (verbose) {
        console.log(`项目配置当前版本: ${currentVersion}`);
        console.log(`目标版本: ${targetVersion}`);
      }

      // 检查是否需要迁移
      if (currentVersion === targetVersion) {
        result.success = true;
        result.warnings.push('项目配置已是最新版本，无需迁移');
        return result;
      }

      if (!force && !this.shouldMigrate(currentVersion, targetVersion)) {
        result.errors.push('项目配置版本不支持降级迁移');
        return result;
      }

      // 创建备份
      if (createBackup && !dryRun) {
        const backupPath = await this.createBackup(configPath, currentVersion, 'project');
        result.backupPath = backupPath;
        if (verbose) {
          console.log(`项目配置备份已创建: ${backupPath}`);
        }
      }

      // 执行迁移
      const migrationChain = this.getMigrationChain(currentVersion, targetVersion);
      let migratedConfig = config;

      for (const migration of migrationChain) {
        if (verbose) {
          console.log(`执行项目配置迁移: ${migration.description}`);
        }

        try {
          migratedConfig = migration.migrator(migratedConfig);
          result.changes.push(migration.description);
          
          if (verbose) {
            console.log(`项目配置迁移完成: ${migration.from} -> ${migration.to}`);
          }
        } catch (error) {
          result.errors.push(`项目配置迁移失败: ${migration.description} - ${error}`);
          return result;
        }
      }

      // 设置版本
      migratedConfig.version = targetVersion;
      migratedConfig.createdAt = new Date().toISOString();

      // 验证迁移后的配置
      const validationResult = this.validateProjectConfig(migratedConfig);
      if (!validationResult.valid) {
        result.errors.push(...validationResult.errors);
        return result;
      }

      result.warnings.push(...validationResult.warnings);

      // 保存新配置
      if (!dryRun) {
        await this.saveProjectConfig(migratedConfig);
        if (verbose) {
          console.log('项目配置迁移完成');
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.push(`项目配置迁移过程发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
      return result;
    }
  }

  /**
   * 执行完整迁移
   */
  async migrateAll(options: MigrationOptions = {}): Promise<{
    user: MigrationResult;
    project: MigrationResult;
    summary: {
      totalChanges: number;
      totalErrors: number;
      totalWarnings: number;
      success: boolean;
    };
  }> {
    const userResult = await this.migrateUserConfig(options);
    const projectResult = await this.migrateProjectConfig(options);

    const summary = {
      totalChanges: userResult.changes.length + projectResult.changes.length,
      totalErrors: userResult.errors.length + projectResult.errors.length,
      totalWarnings: userResult.warnings.length + projectResult.warnings.length,
      success: userResult.success && projectResult.success,
    };

    return {
      user: userResult,
      project: projectResult,
      summary,
    };
  }

  /**
   * 从 v1.0.0 迁移到 v1.1.0
   * 扁平化配置 -> 分层配置
   */
  private migrateFromV1ToV1_1(config: BladeConfig): UserConfig {
    const userConfig: Partial<UserConfig> = {
      auth: {
        apiKey: config.apiKey || '',
        baseUrl: config.baseUrl || 'https://apis.iflow.cn/v1',
        modelName: config.modelName || 'Qwen3-Coder',
        searchApiKey: config.searchApiKey || '',
      },
      ui: {
        theme: config.theme || 'GitHub',
        hideTips: config.hideTips || false,
        hideBanner: config.hideBanner || false,
      },
      security: {
        sandbox: config.sandbox || 'docker',
        trustedFolders: [],
        allowedOperations: ['read', 'write', 'execute'],
      },
      tools: {
        toolDiscoveryCommand: config.toolDiscoveryCommand || 'bin/get_tools',
        toolCallCommand: config.toolCallCommand || 'bin/call_tool',
        summarizeToolOutput: (config as any).tools?.summarizeToolOutput || {},
        autoUpdate: true,
        toolTimeout: 30000,
      },
      mcp: {
        mcpServers: (config as any).mcp?.mcpServers || {
          main: {
            command: 'bin/mcp_server.py',
          },
        },
      },
      telemetry: {
        enabled: (config as any).telemetry?.enabled ?? true,
        target: (config as any).telemetry?.target || 'local',
        otlpEndpoint: (config as any).telemetry?.otlpEndpoint || 'http://localhost:4317',
        logPrompts: (config as any).telemetry?.logPrompts ?? false,
      },
      usage: {
        usageStatisticsEnabled: config.usageStatisticsEnabled || true,
        maxSessionTurns: config.maxSessionTurns || 10,
      },
      debug: {
        debug: config.debug || false,
      },
      preferences: {
        autoSave: true,
        backupEnabled: true,
        backupInterval: 3600,
        autoUpdate: true,
        telemetryOptIn: true,
        darkMode: false,
      },
      version: '1.1.0',
      createdAt: config.createdAt || new Date().toISOString(),
      isValid: true,
    };

    return userConfig as UserConfig;
  }

  /**
   * 从 v1.1.0 迁移到 v1.2.0
   * 添加安全性和扩展配置
   */
  private migrateFromV1_1ToV1_2(config: UserConfig): UserConfig {
    const enhancedConfig = { ...config };

    // 加强安全性配置
    if (!enhancedConfig.security) {
      enhancedConfig.security = {
        sandbox: 'docker',
        trustedFolders: [],
        allowedOperations: ['read', 'write', 'execute'],
      };
    }

    enhancedConfig.security = {
      ...enhancedConfig.security,
      requireConfirmation: enhancedConfig.security.requireConfirmation ?? true,
      disableSafetyChecks: enhancedConfig.security.disableSafetyChecks ?? false,
      maxFileSize: enhancedConfig.security.maxFileSize ?? 1024 * 1024 * 10,
    };

    // 添加扩展配置
    enhancedConfig.extensions = {
      enabled: true,
      directory: './extensions',
      autoLoad: true,
      allowedExtensions: ['.js', '.ts', '.json'],
      dependencies: {},
      security: {
        codeSigning: true,
        sandbox: true,
        networkAccess: false,
      },
    };

    // 完善 UI 配置
    if (!enhancedConfig.ui) {
      enhancedConfig.ui = {
        theme: 'GitHub',
        hideTips: false,
        hideBanner: false,
      };
    }

    enhancedConfig.ui = {
      ...enhancedConfig.ui,
      outputFormat: enhancedConfig.ui.outputFormat || 'text',
      colorScheme: enhancedConfig.ui.colorScheme || 'default',
      fontSize: enhancedConfig.ui.fontSize || 14,
      lineHeight: enhancedConfig.ui.lineHeight || 1.5,
    };

    // 增强调试配置
    if (!enhancedConfig.debug) {
      enhancedConfig.debug = {
        debug: false,
      };
    }

    enhancedConfig.debug = {
      ...enhancedConfig.debug,
      logLevel: enhancedConfig.debug.logLevel || 'info',
      logToFile: enhancedConfig.debug.logToFile || false,
      logFilePath: enhancedConfig.debug.logFilePath || './logs/blade.log',
    };

    enhancedConfig.version = '1.2.0';
    enhancedConfig.lastUpdated = new Date().toISOString();

    return enhancedConfig;
  }

  /**
   * 从 v1.2.0 迁移到 v1.3.0
   * 完善遥测和使用配置
   */
  private migrateFromV1_2ToV1_3(config: UserConfig): UserConfig {
    const enhancedConfig = { ...config };

    // 完善遥测配置
    if (!enhancedConfig.telemetry) {
      enhancedConfig.telemetry = {
        enabled: true,
        target: 'local',
        otlpEndpoint: 'http://localhost:4317',
        logPrompts: false,
      };
    }

    enhancedConfig.telemetry = {
      ...enhancedConfig.telemetry,
      logResponses: enhancedConfig.telemetry.logResponses ?? false,
      batchSize: enhancedConfig.telemetry.batchSize ?? 100,
      flushInterval: enhancedConfig.telemetry.flushInterval ?? 10000,
    };

    // 完善使用配置
    if (!enhancedConfig.usage) {
      enhancedConfig.usage = {
        usageStatisticsEnabled: true,
        maxSessionTurns: 10,
      };
    }

    enhancedConfig.usage = {
      ...enhancedConfig.usage,
      rateLimit: enhancedConfig.usage.rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 3600,
        requestsPerDay: 86400,
      },
      sessionTimeout: enhancedConfig.usage.sessionTimeout ?? 1800000,
      conversationHistory: enhancedConfig.usage.conversationHistory || {
        maxMessages: 100,
        maxTokens: 10000,
        ttl: 86400000,
      },
    };

    // 完善调试配置
    if (!enhancedConfig.debug) {
      enhancedConfig.debug = {
        debug: false,
      };
    }

    enhancedConfig.debug = {
      ...enhancedConfig.debug,
      logRotation: enhancedConfig.debug.logRotation || {
        maxSize: '10MB',
        maxFiles: 5,
        compress: true,
      },
      performanceMonitoring: enhancedConfig.debug.performanceMonitoring || {
        enabled: true,
        samplingRate: 0.1,
        reportInterval: 10000,
      },
    };

    enhancedConfig.version = '1.3.0';
    enhancedConfig.lastUpdated = new Date().toISOString();

    return enhancedConfig;
  }

  /**
   * 获取迁移链
   */
  private getMigrationChain(fromVersion: string, toVersion: string): MigrationVersion[] {
    const chain: MigrationVersion[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const migration = this.migrations.find(m => m.from === currentVersion);
      if (!migration) {
        throw new Error(`找不到从 ${currentVersion} 的迁移路径`);
      }
      chain.push(migration);
      currentVersion = migration.to;
    }

    return chain;
  }

  /**
   * 检查是否应该迁移
   */
  private shouldMigrate(fromVersion: string, toVersion: string): boolean {
    const fromParts = fromVersion.split('.').map(Number);
    const toParts = toVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(fromParts.length, toParts.length); i++) {
      const from = fromParts[i] || 0;
      const to = toParts[i] || 0;
      if (to < from) return false;
      if (to > from) return true;
    }

    return false;
  }

  /**
   * 创建备份
   */
  async createBackup(configPath: string, version: string, type = 'user'): Promise<string> {
    await this.ensureDirectoryExists(this.backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `config-${type}-v${version}-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFileName);

    const configContent = await fs.readFile(configPath as string, 'utf-8');
    await fs.writeFile(backupPath as string, configContent, 'utf-8');

    return backupPath;
  }

  /**
   * 保存用户配置
   */
  private async saveUserConfig(config: UserConfig): Promise<void> {
    const configPath = CONFIG_PATHS.global.userConfig;
    await this.ensureDirectoryExists(path.dirname(configPath));
    
    const configContent = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath as string, configContent, 'utf-8');
  }

  /**
   * 保存项目配置
   */
  private async saveProjectConfig(config: ProjectConfig): Promise<void> {
    const configPath = CONFIG_PATHS.project.bladeConfig;
    await this.ensureDirectoryExists(path.dirname(configPath));
    
    const configContent = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath as string, configContent, 'utf-8');
  }

  /**
   * 验证用户配置
   */
  private validateUserConfig(config: any): { valid: boolean; errors: string[]; warnings: string[] } {
    try {
      UserConfigSchema.parse(config);
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      if (error instanceof Error) {
        return { 
          valid: false, 
          errors: [error.message], 
          warnings: [] 
        };
      }
      return { 
        valid: false, 
        errors: ['未知验证错误'], 
        warnings: [] 
      };
    }
  }

  /**
   * 验证项目配置
   */
  private validateProjectConfig(config: any): { valid: boolean; errors: string[]; warnings: string[] } {
    try {
      ProjectConfigSchema.parse(config);
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      if (error instanceof Error) {
        return { 
          valid: false, 
          errors: [error.message], 
          warnings: [] 
        };
      }
      return { 
        valid: false, 
        errors: ['未知验证错误'], 
        warnings: [] 
      };
    }
  }

  /**
   * 工具方法：检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 工具方法：确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 获取可用的迁移版本
   */
  getAvailableMigrations(): MigrationVersion[] {
    return [...this.migrations];
  }

  /**
   * 检测配置版本
   */
  async detectConfigVersion(configPath: string): Promise<string | null> {
    try {
      if (!await this.fileExists(configPath)) {
        return null;
      }

      const content = await fs.readFile(configPath as string, 'utf-8');
      const config = JSON.parse(content);
      return config.version || '1.0.0';
    } catch {
      return null;
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups(keepCount: number = 5): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir as string);
      const backupFiles = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async file => ({
            name: file,
            path: path.join(this.backupDir, file),
            stat: await fs.stat(path.join(this.backupDir, file) as string),
          }))
      );

      // 按修改时间排序
      const sortedBackups = backupFiles.sort((a, b) => 
        b.stat.mtime.getTime() - a.stat.mtime.getTime()
      );

      // 删除旧备份
      const toDelete = sortedBackups.slice(keepCount);
      for (const backup of toDelete) {
        await fs.unlink(backup.path as string);
        console.log(`删除旧备份: ${backup.name}`);
      }
    } catch (error) {
      console.warn('清理旧备份失败:', error);
    }
  }
}