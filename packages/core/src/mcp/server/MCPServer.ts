import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { BladeConfig } from '../../config/types.js';
import type { McpServer as McpServerConfig } from './types.js';

export class McpServer {
  private server: Server | null = null;
  private config: BladeConfig;
  private serverConfig: McpServerConfig;
  private isRunning = false;

  constructor(config: BladeConfig, serverConfig: McpServerConfig) {
    this.config = config;
    this.serverConfig = serverConfig;
  }

  public async initialize(): Promise<void> {
    // 初始化MCP服务器
    this.server = new Server(
      {
        name: this.serverConfig.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // 注册处理程序
    this.registerHandlers();

    console.log(`MCP服务器初始化完成: ${this.serverConfig.name}`);
  }

  private registerHandlers(): void {
    if (!this.server) return;

    // 注册工具调用处理程序
    this.server.setRequestHandler(
      { method: 'tools/call' },
      async (request) => {
        try {
          const result = await this.handleToolCall(request.params);
          return { result };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );

    // 注册资源列表处理程序
    this.server.setRequestHandler(
      { method: 'resources/list' },
      async () => {
        try {
          const resources = await this.handleListResources();
          return { resources };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );

    // 注册资源读取处理程序
    this.server.setRequestHandler(
      { method: 'resources/read' },
      async (request) => {
        try {
          const contents = await this.handleReadResource(request.params.uri);
          return { contents };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );

    // 注册工具列表处理程序
    this.server.setRequestHandler(
      { method: 'tools/list' },
      async () => {
        try {
          const tools = await this.handleListTools();
          return { tools };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );

    // 注册提示列表处理程序
    this.server.setRequestHandler(
      { method: 'prompts/list' },
      async () => {
        try {
          const prompts = await this.handleListPrompts();
          return { prompts };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );

    // 注册提示获取处理程序
    this.server.setRequestHandler(
      { method: 'prompts/get' },
      async (request) => {
        try {
          const prompt = await this.handleGetPrompt(request.params.name);
          return { prompt };
        } catch (error) {
          return { error: { code: -32000, message: (error as Error).message } };
        }
      }
    );
  }

  private async handleToolCall(params: any): Promise<any> {
    console.log(`调用工具: ${params.name}`, params.arguments);
    
    // 这里应该实现具体的工具调用逻辑
    // 暂时返回模拟结果
    return {
      content: `工具 ${params.name} 执行结果`,
      isError: false,
    };
  }

  private async handleListResources(): Promise<any[]> {
    console.log('列出资源');
    
    // 这里应该实现资源列表逻辑
    // 暂时返回空数组
    return [];
  }

  private async handleReadResource(uri: string): Promise<Array<{ text: string }>> {
    console.log(`读取资源: ${uri}`);
    
    // 这里应该实现资源读取逻辑
    // 暂时返回模拟内容
    return [{ text: `资源内容: ${uri}` }];
  }

  private async handleListTools(): Promise<any[]> {
    console.log('列出工具');
    
    // 这里应该实现工具列表逻辑
    // 暂时返回模拟工具列表
    return [
      {
        name: 'echo',
        description: '回显输入的文本',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
      },
    ];
  }

  private async handleListPrompts(): Promise<any[]> {
    console.log('列出提示');
    
    // 这里应该实现提示列表逻辑
    // 暂时返回空数组
    return [];
  }

  private async handleGetPrompt(name: string): Promise<any> {
    console.log(`获取提示: ${name}`);
    
    // 这里应该实现提示获取逻辑
    // 暂时抛出错误
    throw new Error(`提示未找到: ${name}`);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`MCP服务器已在运行: ${this.serverConfig.name}`);
      return;
    }

    if (!this.server) {
      await this.initialize();
    }

    try {
      // 启动服务器
      switch (this.serverConfig.transport) {
        case 'stdio':
          await this.startStdioServer();
          break;
        case 'sse':
          await this.startSseServer();
          break;
        case 'websocket':
          await this.startWebSocketServer();
          break;
        default:
          throw new Error(`不支持的传输类型: ${this.serverConfig.transport}`);
      }

      this.isRunning = true;
      console.log(`MCP服务器已启动: ${this.serverConfig.name}`);
    } catch (error) {
      console.error(`启动MCP服务器失败: ${this.serverConfig.name}`, error);
      throw error;
    }
  }

  private async startStdioServer(): Promise<void> {
    if (!this.server) {
      throw new Error('服务器未初始化');
    }

    // 启动stdio服务器
    this.server.listen();
    console.log('STDIO服务器已启动');
  }

  private async startSseServer(): Promise<void> {
    // 这里应该实现SSE服务器启动逻辑
    console.log('SSE服务器启动 (模拟)');
  }

  private async startWebSocketServer(): Promise<void> {
    // 这里应该实现WebSocket服务器启动逻辑
    console.log('WebSocket服务器启动 (模拟)');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log(`MCP服务器未运行: ${this.serverConfig.name}`);
      return;
    }

    try {
      if (this.server) {
        this.server.close();
      }

      this.isRunning = false;
      console.log(`MCP服务器已停止: ${this.serverConfig.name}`);
    } catch (error) {
      console.error(`停止MCP服务器失败: ${this.serverConfig.name}`, error);
      throw error;
    }
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public getServerConfig(): McpServerConfig {
    return { ...this.serverConfig };
  }

  public async getServerInfo(): Promise<any> {
    return {
      name: this.serverConfig.name,
      version: this.config.version,
      transport: this.serverConfig.transport,
      status: this.isRunning ? 'running' : 'stopped',
      capabilities: this.serverConfig.capabilities,
    };
  }

  public async healthCheck(): Promise<ServerHealth> {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      checks: [
        {
          name: 'server_running',
          status: this.isRunning ? 'pass' : 'fail',
          message: this.isRunning ? '服务器正在运行' : '服务器未运行',
        },
      ],
    };
  }

  public async destroy(): Promise<void> {
    if (this.isRunning) {
      await this.stop();
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    console.log(`MCP服务器已销毁: ${this.serverConfig.name}`);
  }
}

// 服务器组管理器
export class McpServerGroup {
  private servers: Map<string, McpServer> = new Map();
  private config: BladeConfig;

  constructor(config: BladeConfig) {
    this.config = config;
  }

  public async addServer(server: McpServer): Promise<void> {
    const serverConfig = server.getServerConfig();
    if (this.servers.has(serverConfig.id)) {
      console.warn(`服务器已存在，将被覆盖: ${serverConfig.id}`);
    }

    this.servers.set(serverConfig.id, server);
    console.log(`添加服务器到组: ${serverConfig.name}`);
  }

  public async removeServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`服务器未找到: ${serverId}`);
    }

    await server.destroy();
    this.servers.delete(serverId);
    console.log(`从组中移除服务器: ${serverId}`);
  }

  public async startAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.servers.values()).map(server => server.start())
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      console.error(`启动 ${failed.length} 个服务器失败`);
    }
  }

  public async stopAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.servers.values()).map(server => server.stop())
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      console.error(`停止 ${failed.length} 个服务器失败`);
    }
  }

  public getServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  public getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId);
  }

  public async healthCheckAll(): Promise<ServerGroupHealth> {
    const serverHealths = await Promise.all(
      Array.from(this.servers.entries()).map(async ([id, server]) => {
        const health = await server.healthCheck();
        return { serverId: id, health };
      })
    );

    const unhealthyServers = serverHealths.filter(
      ({ health }) => health.status === 'unhealthy'
    );

    return {
      status: unhealthyServers.length === 0 ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      servers: serverHealths,
      summary: {
        total: serverHealths.length,
        healthy: serverHealths.length - unhealthyServers.length,
        unhealthy: unhealthyServers.length,
      },
    };
  }
}

// 类型定义
interface ServerHealth {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message: string;
  }>;
}

interface ServerGroupHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  servers: Array<{ serverId: string; health: ServerHealth }>;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
}