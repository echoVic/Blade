import { EventEmitter } from 'events';
import { MCPClient, MCPConnectionConfig, MCPSession, MCPTool } from '../../../mcp/index.js';
import { BladeToolkit } from '../BladeToolkit.js';
import { RiskLevel, ToolCategory } from '../types.js';
import { MCPToolAdapter, MCPToolAdapterConfig } from './MCPToolAdapter.js';

/**
 * MCP 连接配置
 */
export interface MCPServerConfig extends MCPConnectionConfig {
  autoConnect?: boolean;
  autoRegisterTools?: boolean;
  toolCategory?: string;
  toolRiskLevel?: string;
  requiresConfirmation?: boolean;
}

/**
 * MCP 工具发现配置
 */
export interface MCPToolDiscoveryConfig {
  includePatterns?: string[];
  excludePatterns?: string[];
  categoryMapping?: Record<string, string>;
  riskLevelMapping?: Record<string, string>;
}

/**
 * MCP 工具管理器统计信息
 */
export interface MCPManagerStats {
  totalConnections: number;
  activeConnections: number;
  totalTools: number;
  toolsByServer: Record<string, number>;
  toolsByCategory: Record<string, number>;
  connectionErrors: number;
  lastDiscovery?: Date;
}

/**
 * MCP 工具管理器
 * 负责管理 MCP 连接、工具发现和注册
 */
export class MCPToolManager extends EventEmitter {
  private client: MCPClient;
  private sessions: Map<string, MCPSession> = new Map();
  private tools: Map<string, MCPToolAdapter> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private discoveryConfig: MCPToolDiscoveryConfig;
  private stats: MCPManagerStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalTools: 0,
    toolsByServer: {},
    toolsByCategory: {},
    connectionErrors: 0,
  };

  constructor(discoveryConfig: MCPToolDiscoveryConfig = {}) {
    super();
    this.client = new MCPClient();
    this.discoveryConfig = discoveryConfig;

    // 监听 MCP 客户端事件
    this.setupClientEventListeners();
  }

  /**
   * 添加 MCP 服务器配置
   */
  addServer(config: MCPServerConfig): void {
    this.serverConfigs.set(config.name, config);
    this.emit('serverAdded', config);

    if (config.autoConnect) {
      this.connectToServer(config.name).catch(error => {
        this.emit('connectionError', { serverName: config.name, error });
      });
    }
  }

  /**
   * 移除 MCP 服务器配置
   */
  removeServer(serverName: string): void {
    const config = this.serverConfigs.get(serverName);
    if (!config) return;

    // 断开连接
    this.disconnectFromServer(serverName);

    // 移除服务器工具
    this.removeServerTools(serverName);

    this.serverConfigs.delete(serverName);
    this.emit('serverRemoved', serverName);
  }

  /**
   * 连接到 MCP 服务器
   */
  async connectToServer(serverName: string): Promise<MCPSession> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    try {
      const session = await this.client.connect(config);
      this.sessions.set(serverName, session);
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      this.emit('connected', { serverName, session });

      // 自动发现和注册工具
      if (config.autoRegisterTools) {
        await this.discoverServerTools(serverName);
      }

      return session;
    } catch (error) {
      this.stats.connectionErrors++;
      this.emit('connectionError', { serverName, error });
      throw error;
    }
  }

  /**
   * 断开 MCP 服务器连接
   */
  async disconnectFromServer(serverName: string): Promise<void> {
    const session = this.sessions.get(serverName);
    if (!session) return;

    try {
      await this.client.disconnect(session.id);
      this.sessions.delete(serverName);
      this.stats.activeConnections--;

      this.emit('disconnected', serverName);
    } catch (error) {
      this.emit('error', { operation: 'disconnect', serverName, error });
    }
  }

  /**
   * 发现服务器工具
   */
  async discoverServerTools(serverName: string): Promise<MCPTool[]> {
    const session = this.sessions.get(serverName);
    if (!session) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    try {
      const mcpTools = await this.client.listTools(session.id);
      const filteredTools = this.filterTools(mcpTools);

      this.emit('toolsDiscovered', { serverName, tools: filteredTools });
      this.stats.lastDiscovery = new Date();

      return filteredTools;
    } catch (error) {
      this.emit('error', { operation: 'discoverTools', serverName, error });
      throw error;
    }
  }

  /**
   * 注册 MCP 工具到工具包
   */
  async registerToolsToToolkit(toolkit: BladeToolkit, serverName?: string): Promise<void> {
    const serversToRegister = serverName ? [serverName] : Array.from(this.sessions.keys());

    for (const server of serversToRegister) {
      try {
        const tools = await this.discoverServerTools(server);
        const adapters = await this.createToolAdapters(server, tools);

        toolkit.registerTools(adapters, { override: true });

        // 更新统计信息
        this.updateToolStats(server, adapters);

        this.emit('toolsRegistered', {
          serverName: server,
          toolCount: adapters.length,
          toolNames: adapters.map(t => t.name),
        });
      } catch (error) {
        this.emit('error', { operation: 'registerTools', serverName: server, error });
      }
    }
  }

  /**
   * 创建工具适配器
   */
  private async createToolAdapters(
    serverName: string,
    mcpTools: MCPTool[]
  ): Promise<MCPToolAdapter[]> {
    const session = this.sessions.get(serverName);
    if (!session) {
      throw new Error(`Session not found for server: ${serverName}`);
    }

    const config = this.serverConfigs.get(serverName);
    const adapters: MCPToolAdapter[] = [];

    for (const mcpTool of mcpTools) {
      try {
        const adapterConfig: MCPToolAdapterConfig = {
          client: this.client,
          sessionId: session.id,
          mcpTool,
          category: this.getToolCategory(mcpTool, config),
          riskLevel: this.getToolRiskLevel(mcpTool, config),
          requiresConfirmation: config?.requiresConfirmation ?? true,
        };

        const adapter = new MCPToolAdapter(adapterConfig);
        adapters.push(adapter);

        // 缓存工具适配器
        const toolKey = `${serverName}:${mcpTool.name}`;
        this.tools.set(toolKey, adapter);
      } catch (error) {
        this.emit('error', {
          operation: 'createAdapter',
          serverName,
          toolName: mcpTool.name,
          error,
        });
      }
    }

    return adapters;
  }

  /**
   * 获取工具分类
   */
  private getToolCategory(mcpTool: MCPTool, config?: MCPServerConfig): string {
    // 首先检查发现配置中的分类映射
    if (this.discoveryConfig.categoryMapping) {
      const mapped = this.discoveryConfig.categoryMapping[mcpTool.name];
      if (mapped) return mapped;
    }

    // 然后检查服务器配置
    if (config?.toolCategory) {
      return config.toolCategory;
    }

    // 基于工具名称推断分类
    const name = mcpTool.name.toLowerCase();
    if (name.includes('file') || name.includes('read') || name.includes('write')) {
      return ToolCategory.FILESYSTEM;
    }
    if (name.includes('git') || name.includes('commit') || name.includes('branch')) {
      return ToolCategory.GIT;
    }
    if (name.includes('http') || name.includes('api') || name.includes('request')) {
      return ToolCategory.NETWORK;
    }
    if (name.includes('text') || name.includes('search') || name.includes('replace')) {
      return ToolCategory.TEXT;
    }

    return ToolCategory.MCP;
  }

  /**
   * 获取工具风险级别
   */
  private getToolRiskLevel(mcpTool: MCPTool, config?: MCPServerConfig): string {
    // 首先检查发现配置中的风险级别映射
    if (this.discoveryConfig.riskLevelMapping) {
      const mapped = this.discoveryConfig.riskLevelMapping[mcpTool.name];
      if (mapped) return mapped;
    }

    // 然后检查服务器配置
    if (config?.toolRiskLevel) {
      return config.toolRiskLevel;
    }

    // 基于工具名称推断风险级别
    const name = mcpTool.name.toLowerCase();
    const description = mcpTool.description.toLowerCase();

    if (
      name.includes('delete') ||
      name.includes('remove') ||
      name.includes('destroy') ||
      description.includes('delete') ||
      description.includes('remove')
    ) {
      return RiskLevel.HIGH;
    }

    if (
      name.includes('write') ||
      name.includes('create') ||
      name.includes('modify') ||
      description.includes('write') ||
      description.includes('modify')
    ) {
      return RiskLevel.MODERATE;
    }

    return RiskLevel.SAFE;
  }

  /**
   * 过滤工具
   */
  private filterTools(mcpTools: MCPTool[]): MCPTool[] {
    return mcpTools.filter(tool => {
      // 包含模式检查
      if (this.discoveryConfig.includePatterns && this.discoveryConfig.includePatterns.length > 0) {
        const included = this.discoveryConfig.includePatterns.some(pattern =>
          new RegExp(pattern).test(tool.name)
        );
        if (!included) return false;
      }

      // 排除模式检查
      if (this.discoveryConfig.excludePatterns && this.discoveryConfig.excludePatterns.length > 0) {
        const excluded = this.discoveryConfig.excludePatterns.some(pattern =>
          new RegExp(pattern).test(tool.name)
        );
        if (excluded) return false;
      }

      return true;
    });
  }

  /**
   * 移除服务器工具
   */
  private removeServerTools(serverName: string): void {
    const toolsToRemove = Array.from(this.tools.keys()).filter(key =>
      key.startsWith(`${serverName}:`)
    );

    for (const toolKey of toolsToRemove) {
      this.tools.delete(toolKey);
    }

    delete this.stats.toolsByServer[serverName];
  }

  /**
   * 更新工具统计信息
   */
  private updateToolStats(serverName: string, adapters: MCPToolAdapter[]): void {
    this.stats.toolsByServer[serverName] = adapters.length;
    this.stats.totalTools = Object.values(this.stats.toolsByServer).reduce(
      (sum, count) => sum + count,
      0
    );

    // 更新分类统计
    this.stats.toolsByCategory = {};
    for (const adapter of this.tools.values()) {
      const category = adapter.category;
      this.stats.toolsByCategory[category] = (this.stats.toolsByCategory[category] || 0) + 1;
    }
  }

  /**
   * 设置客户端事件监听器
   */
  private setupClientEventListeners(): void {
    this.client.on('connected', (session: MCPSession) => {
      this.emit('mcpConnected', session);
    });

    this.client.on('disconnected', (sessionId: string) => {
      this.emit('mcpDisconnected', sessionId);
    });

    this.client.on('error', (error: Error) => {
      this.emit('mcpError', error);
    });
  }

  /**
   * 获取所有会话
   */
  getSessions(): Map<string, MCPSession> {
    return new Map(this.sessions);
  }

  /**
   * 获取所有工具适配器
   */
  getTools(): Map<string, MCPToolAdapter> {
    return new Map(this.tools);
  }

  /**
   * 获取统计信息
   */
  getStats(): MCPManagerStats {
    return { ...this.stats };
  }

  /**
   * 获取服务器配置
   */
  getServerConfigs(): Map<string, MCPServerConfig> {
    return new Map(this.serverConfigs);
  }

  /**
   * 检查服务器连接状态
   */
  isServerConnected(serverName: string): boolean {
    const session = this.sessions.get(serverName);
    return session?.connected || false;
  }

  /**
   * 重新发现所有工具
   */
  async rediscoverAllTools(): Promise<void> {
    const serverNames = Array.from(this.sessions.keys());

    for (const serverName of serverNames) {
      try {
        await this.discoverServerTools(serverName);
      } catch (error) {
        this.emit('error', { operation: 'rediscoverTools', serverName, error });
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    const disconnectPromises = Array.from(this.sessions.keys()).map(serverName =>
      this.disconnectFromServer(serverName)
    );

    await Promise.allSettled(disconnectPromises);

    this.sessions.clear();
    this.tools.clear();
    this.emit('cleanup');
  }
}
