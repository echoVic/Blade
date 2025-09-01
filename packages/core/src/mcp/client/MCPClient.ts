import {
  Client,
  MessageType,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  LlmV1Role,
  SamplingMessage,
} from '@modelcontextprotocol/sdk/client/index.js';
import type { BladeConfig } from '../config/types.js';
import type { McpServer } from './types.js';

export class McpClient {
  private client: Client | null = null;
  private config: BladeConfig;
  private servers: Map<string, McpServer> = new Map();
  private activeConnections: Map<string, Client> = new Map();
  private requestTimeout: number;

  constructor(config: BladeConfig) {
    this.config = config;
    this.requestTimeout = config.mcp.timeout || 30000;
  }

  public async initialize(): Promise<void> {
    console.log('MCP客户端初始化完成');
  }

  public async connectToServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    
    if (!server) {
      throw new Error(`MCP服务器未找到: ${serverId}`);
    }

    if (this.activeConnections.has(serverId)) {
      console.log(`已连接到MCP服务器: ${serverId}`);
      return;
    }

    try {
      // 创建MCP客户端
      const client = new Client({
        name: 'Blade AI',
        version: this.config.version,
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        }
      });

      // 连接到服务器
      await this.establishConnection(client, server);
      
      // 保存连接
      this.activeConnections.set(serverId, client);
      
      console.log(`成功连接到MCP服务器: ${server.name}`);
    } catch (error) {
      console.error(`连接MCP服务器失败: ${serverId}`, error);
      throw error;
    }
  }

  private async establishConnection(client: Client, server: McpServer): Promise<void> {
    // 这里应该根据传输类型建立连接
    // 暂时留空，后续实现具体的连接逻辑
    console.log(`建立连接到: ${server.endpoint}`);
  }

  public async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      console.log(`未连接到MCP服务器: ${serverId}`);
      return;
    }

    try {
      // 关闭连接
      client.close();
      
      // 移除连接
      this.activeConnections.delete(serverId);
      
      console.log(`已断开MCP服务器连接: ${serverId}`);
    } catch (error) {
      console.error(`断开MCP服务器连接失败: ${serverId}`, error);
      throw error;
    }
  }

  public async callTool(
    serverId: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<any> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: arguments_,
        },
      };

      const result = await Promise.race([
        client.request(CallToolRequestSchema, request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('工具调用超时')), this.requestTimeout)
        )
      ]);

      return result;
    } catch (error) {
      console.error(`调用工具失败: ${toolName}`, error);
      throw error;
    }
  }

  public async listResources(serverId: string): Promise<any[]> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'resources/list',
        params: {},
      };

      const result = await Promise.race([
        client.request(ListResourcesRequestSchema, request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('资源列表获取超时')), this.requestTimeout)
        )
      ]);

      return result.resources;
    } catch (error) {
      console.error('获取资源列表失败:', error);
      throw error;
    }
  }

  public async readResource(serverId: string, uri: string): Promise<string> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'resources/read',
        params: {
          uri: uri,
        },
      };

      const result = await Promise.race([
        client.request(ReadResourceRequestSchema, request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('资源读取超时')), this.requestTimeout)
        )
      ]);

      return result.contents[0].text;
    } catch (error) {
      console.error(`读取资源失败: ${uri}`, error);
      throw error;
    }
  }

  public async sendMessage(
    serverId: string,
    messages: SamplingMessage[]
  ): Promise<SamplingMessage[]> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'sampling/createMessage',
        params: {
          messages: messages,
          includeUsage: true,
        },
      };

      const result = await Promise.race([
        client.request(
          {
            method: 'sampling/createMessage',
            params: {
              messages: messages,
              includeUsage: true,
            },
          },
          request
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('消息发送超时')), this.requestTimeout)
        )
      ]);

      return result.messages;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  public async listTools(serverId: string): Promise<any[]> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'tools/list',
        params: {},
      };

      const result = await client.request(
        {
          method: 'tools/list',
          params: {},
        },
        request
      );

      return result.tools;
    } catch (error) {
      console.error('获取工具列表失败:', error);
      throw error;
    }
  }

  public async listPrompts(serverId: string): Promise<any[]> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'prompts/list',
        params: {},
      };

      const result = await client.request(
        {
          method: 'prompts/list',
          params: {},
        },
        request
      );

      return result.prompts;
    } catch (error) {
      console.error('获取提示列表失败:', error);
      throw error;
    }
  }

  public async getPrompt(serverId: string, promptName: string): Promise<any> {
    const client = this.activeConnections.get(serverId);
    
    if (!client) {
      throw new Error(`未连接到MCP服务器: ${serverId}`);
    }

    try {
      const request = {
        _meta: {
          timestamp: new Date().toISOString(),
        },
        method: 'prompts/get',
        params: {
          name: promptName,
        },
      };

      const result = await client.request(
        {
          method: 'prompts/get',
          params: {
            name: promptName,
          },
        },
        request
      );

      return result;
    } catch (error) {
      console.error(`获取提示失败: ${promptName}`, error);
      throw error;
    }
  }

  public registerServer(server: McpServer): void {
    if (this.servers.has(server.id)) {
      console.warn(`MCP服务器已存在，将被覆盖: ${server.id}`);
    }

    this.servers.set(server.id, server);
    console.log(`注册MCP服务器: ${server.name}`);
  }

  public unregisterServer(serverId: string): void {
    if (!this.servers.has(serverId)) {
      throw new Error(`MCP服务器未找到: ${serverId}`);
    }

    this.servers.delete(serverId);
    console.log(`注销MCP服务器: ${serverId}`);
  }

  public getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId);
  }

  public getAllServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  public getConnectedServers(): string[] {
    return Array.from(this.activeConnections.keys());
  }

  public isConnected(serverId: string): boolean {
    return this.activeConnections.has(serverId);
  }

  public async destroy(): Promise<void> {
    // 断开所有连接
    for (const [serverId, client] of this.activeConnections.entries()) {
      try {
        client.close();
        console.log(`已断开MCP服务器连接: ${serverId}`);
      } catch (error) {
        console.error(`断开MCP服务器连接失败: ${serverId}`, error);
      }
    }

    this.activeConnections.clear();
    this.servers.clear();
    
    console.log('MCP客户端已销毁');
  }
}