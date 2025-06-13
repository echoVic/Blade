/**
 * 扩展系统类型定义
 */

/**
 * 扩展类型枚举
 */
export const ExtensionType = {
  TOOL: 'tool',
  AGENT: 'agent',
  MODEL: 'model',
  MEMORY: 'memory',
  PROMPT: 'prompt',
  CHAIN: 'chain',
  MCP: 'mcp',
  PLUGIN: 'plugin',
} as const;

export type ExtensionTypeValue = (typeof ExtensionType)[keyof typeof ExtensionType];

/**
 * 扩展状态
 */
export const ExtensionStatus = {
  INACTIVE: 'inactive',
  LOADING: 'loading',
  ACTIVE: 'active',
  ERROR: 'error',
  DISABLED: 'disabled',
} as const;

export type ExtensionStatusValue = (typeof ExtensionStatus)[keyof typeof ExtensionStatus];

/**
 * 扩展元数据
 */
export interface ExtensionMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  type: ExtensionTypeValue;
  category?: string;

  // 依赖信息
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // 系统要求
  engines?: {
    node?: string;
    npm?: string;
    blade?: string;
  };

  // 配置模式
  configSchema?: Record<string, any>;

  // 权限要求
  permissions?: string[];

  // 安装信息
  installTime?: Date;
  updateTime?: Date;
}

/**
 * 扩展配置
 */
export interface ExtensionConfig {
  enabled: boolean;
  autoLoad?: boolean;
  config?: Record<string, any>;
  priority?: number;
  environment?: 'development' | 'production' | 'test';
}

/**
 * 扩展上下文
 */
export interface ExtensionContext {
  extensionId: string;
  workspace: string;
  version: string;
  environment: string;
  logger: ExtensionLogger;
  storage: ExtensionStorage;
  events: ExtensionEventEmitter;
  api: ExtensionAPI;
}

/**
 * 扩展日志接口
 */
export interface ExtensionLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * 扩展存储接口
 */
export interface ExtensionStorage {
  get<T = any>(key: string): Promise<T | undefined>;
  set<T = any>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * 扩展事件发射器接口
 */
export interface ExtensionEventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): boolean;
  once(event: string, listener: (...args: any[]) => void): void;
}

/**
 * 扩展 API 接口
 */
export interface ExtensionAPI {
  // 工具相关
  registerTool(tool: any): Promise<void>;
  unregisterTool(toolName: string): Promise<void>;
  getTool(toolName: string): any;
  listTools(): any[];

  // Agent 相关
  registerAgent(agent: any): Promise<void>;
  unregisterAgent(agentName: string): Promise<void>;
  getAgent(agentName: string): any;
  listAgents(): any[];

  // 模型相关
  registerModel(model: any): Promise<void>;
  unregisterModel(modelName: string): Promise<void>;
  getModel(modelName: string): any;
  listModels(): any[];

  // MCP 相关
  registerMCPServer(config: any): Promise<void>;
  unregisterMCPServer(serverName: string): Promise<void>;
  getMCPServers(): any[];

  // 配置相关
  getConfig<T = any>(key: string): T | undefined;
  setConfig<T = any>(key: string, value: T): Promise<void>;

  // 通知相关
  showMessage(message: string, type?: 'info' | 'warn' | 'error'): void;
  showProgress(title: string, task: Promise<any>): Promise<any>;
}

/**
 * 扩展生命周期钩子
 */
export interface ExtensionHooks {
  onActivate?(context: ExtensionContext): Promise<void> | void;
  onDeactivate?(context: ExtensionContext): Promise<void> | void;
  onConfigChange?(config: Record<string, any>, context: ExtensionContext): Promise<void> | void;
  onUninstall?(context: ExtensionContext): Promise<void> | void;
}

/**
 * 扩展主接口
 */
export interface Extension extends ExtensionHooks {
  readonly metadata: ExtensionMetadata;
  readonly status: ExtensionStatusValue;

  // 生命周期方法
  activate(context: ExtensionContext): Promise<void>;
  deactivate(): Promise<void>;
  configure(config: Record<string, any>): Promise<void>;

  // 状态查询
  isActive(): boolean;
  getConfig(): Record<string, any>;
  getContext(): ExtensionContext | undefined;
}

/**
 * 扩展描述符
 */
export interface ExtensionDescriptor {
  metadata: ExtensionMetadata;
  config: ExtensionConfig;
  status: ExtensionStatusValue;
  error?: string;
  loadTime?: number;
  activateTime?: number;
}

/**
 * 扩展管理器事件
 */
export const ExtensionManagerEvent = {
  EXTENSION_LOADED: 'extension:loaded',
  EXTENSION_ACTIVATED: 'extension:activated',
  EXTENSION_DEACTIVATED: 'extension:deactivated',
  EXTENSION_UNLOADED: 'extension:unloaded',
  EXTENSION_ERROR: 'extension:error',
  EXTENSION_CONFIG_CHANGED: 'extension:config:changed',
} as const;

export type ExtensionManagerEventValue =
  (typeof ExtensionManagerEvent)[keyof typeof ExtensionManagerEvent];

/**
 * 扩展搜索选项
 */
export interface ExtensionSearchOptions {
  type?: ExtensionTypeValue;
  category?: string;
  status?: ExtensionStatusValue;
  keywords?: string[];
  author?: string;
  namePattern?: string;
}

/**
 * 扩展安装选项
 */
export interface ExtensionInstallOptions {
  version?: string;
  force?: boolean;
  skipDependencies?: boolean;
  autoActivate?: boolean;
  config?: Record<string, any>;
}

/**
 * 扩展统计信息
 */
export interface ExtensionStats {
  totalExtensions: number;
  activeExtensions: number;
  extensionsByType: Record<string, number>;
  extensionsByStatus: Record<string, number>;
  averageLoadTime: number;
  averageActivateTime: number;
  totalMemoryUsage: number;
  lastUpdate: Date;
}

/**
 * 扩展依赖解析结果
 */
export interface ExtensionDependencyResult {
  resolved: string[];
  missing: string[];
  conflicts: Array<{
    extension: string;
    required: string;
    installed: string;
  }>;
}

/**
 * 扩展市场信息
 */
export interface ExtensionMarketplace {
  registry: string;
  searchEndpoint: string;
  downloadEndpoint: string;
  auth?: {
    type: 'token' | 'basic';
    credentials: Record<string, string>;
  };
}

/**
 * 扩展更新信息
 */
export interface ExtensionUpdateInfo {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  breaking?: boolean;
  size?: number;
  publishedAt?: Date;
}
