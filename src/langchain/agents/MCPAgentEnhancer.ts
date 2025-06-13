import { MCPServerConfig, MCPToolManager } from '../tools/mcp/MCPToolManager.js';
import { BladeAgent } from './BladeAgent.js';

/**
 * MCP Agent 增强配置
 */
export interface MCPAgentEnhancerConfig {
  mcpServers: MCPServerConfig[];
  autoConnect?: boolean;
  autoDiscoverTools?: boolean;
  enableHotReload?: boolean;
  fallbackTimeout?: number;
}

/**
 * MCP Agent 增强器
 * 为 Agent 提供 MCP 工具集成和动态工具发现能力
 */
export class MCPAgentEnhancer {
  private mcpManager: MCPToolManager;
  private agent: BladeAgent;
  private config: MCPAgentEnhancerConfig;
  private isInitialized = false;

  constructor(agent: BladeAgent, config: MCPAgentEnhancerConfig) {
    this.agent = agent;
    this.config = config;
    this.mcpManager = new MCPToolManager({
      includePatterns: ['.*'], // 默认包含所有工具
      excludePatterns: [], // 不排除任何工具
    });

    this.setupEventListeners();
  }

  /**
   * 初始化 MCP 增强功能
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 配置 MCP 服务器
      for (const serverConfig of this.config.mcpServers) {
        this.mcpManager.addServer({
          ...serverConfig,
          autoConnect: this.config.autoConnect ?? true,
          autoRegisterTools: this.config.autoDiscoverTools ?? true,
        });
      }

      // 如果启用自动连接，等待连接完成
      if (this.config.autoConnect) {
        await this.waitForConnections();
      }

      // 注册 MCP 工具到 Agent 的工具包
      if (this.config.autoDiscoverTools) {
        await this.registerMCPTools();
      }

      this.isInitialized = true;
      console.log('✅ MCP Agent 增强器初始化完成');
    } catch (error) {
      console.error('❌ MCP Agent 增强器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 添加 MCP 服务器
   */
  async addMCPServer(config: MCPServerConfig): Promise<void> {
    this.mcpManager.addServer({
      ...config,
      autoConnect: true,
      autoRegisterTools: true,
    });

    // 连接并注册工具
    try {
      const session = await this.mcpManager.connectToServer(config.name);
      await this.mcpManager.registerToolsToToolkit(this.agent.getToolkit(), config.name);

      console.log(`✅ 已添加 MCP 服务器: ${config.name}`);
    } catch (error) {
      console.error(`❌ 添加 MCP 服务器失败 ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * 移除 MCP 服务器
   */
  async removeMCPServer(serverName: string): Promise<void> {
    try {
      this.mcpManager.removeServer(serverName);

      // TODO: 从工具包中移除该服务器的工具
      // 这需要在 BladeToolkit 中添加按来源移除工具的功能

      console.log(`✅ 已移除 MCP 服务器: ${serverName}`);
    } catch (error) {
      console.error(`❌ 移除 MCP 服务器失败 ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * 重新发现所有 MCP 工具
   */
  async rediscoverTools(): Promise<void> {
    try {
      await this.mcpManager.rediscoverAllTools();
      await this.registerMCPTools();

      console.log('✅ MCP 工具重新发现完成');
    } catch (error) {
      console.error('❌ MCP 工具重新发现失败:', error);
      throw error;
    }
  }

  /**
   * 获取 MCP 连接状态
   */
  getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    const serverConfigs = this.mcpManager.getServerConfigs();

    for (const [serverName] of serverConfigs) {
      status[serverName] = this.mcpManager.isServerConnected(serverName);
    }

    return status;
  }

  /**
   * 获取 MCP 统计信息
   */
  getMCPStats(): any {
    return this.mcpManager.getStats();
  }

  /**
   * 获取可用的 MCP 工具列表
   */
  getMCPTools(): string[] {
    const tools = this.mcpManager.getTools();
    return Array.from(tools.keys());
  }

  /**
   * 检查特定 MCP 工具是否可用
   */
  isMCPToolAvailable(toolName: string): boolean {
    const tools = this.mcpManager.getTools();
    return Array.from(tools.values()).some(tool => tool.name === toolName && tool.isConnected());
  }

  /**
   * 私有方法：等待连接完成
   */
  private async waitForConnections(): Promise<void> {
    const timeout = this.config.fallbackTimeout || 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const stats = this.mcpManager.getStats();
      if (stats.activeConnections === this.config.mcpServers.length) {
        return;
      }

      // 等待 100ms 后重试
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.warn('⚠️ 部分 MCP 服务器连接超时');
  }

  /**
   * 私有方法：注册 MCP 工具
   */
  private async registerMCPTools(): Promise<void> {
    try {
      await this.mcpManager.registerToolsToToolkit(this.agent.getToolkit());

      const stats = this.mcpManager.getStats();
      console.log(`📦 已注册 ${stats.totalTools} 个 MCP 工具`);
    } catch (error) {
      console.error('❌ 注册 MCP 工具失败:', error);
      throw error;
    }
  }

  /**
   * 私有方法：设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听连接事件
    this.mcpManager.on('connected', ({ serverName, session }) => {
      console.log(`🔗 MCP 服务器已连接: ${serverName}`);
    });

    this.mcpManager.on('disconnected', serverName => {
      console.log(`🔌 MCP 服务器已断开: ${serverName}`);
    });

    this.mcpManager.on('toolsDiscovered', ({ serverName, tools }) => {
      console.log(`🔍 发现 ${tools.length} 个工具 (${serverName})`);
    });

    this.mcpManager.on('toolsRegistered', ({ serverName, toolCount }) => {
      console.log(`📝 已注册 ${toolCount} 个工具 (${serverName})`);
    });

    this.mcpManager.on('error', ({ operation, serverName, error }) => {
      console.error(`❌ MCP 错误 [${operation}] ${serverName}:`, error);
    });

    // 如果启用热重载，监听工具变化
    if (this.config.enableHotReload) {
      this.mcpManager.on('toolsDiscovered', async () => {
        try {
          await this.registerMCPTools();
        } catch (error) {
          console.error('❌ 热重载工具失败:', error);
        }
      });
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.mcpManager.cleanup();
      this.isInitialized = false;
      console.log('🧹 MCP Agent 增强器已清理');
    } catch (error) {
      console.error('❌ MCP Agent 增强器清理失败:', error);
    }
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
