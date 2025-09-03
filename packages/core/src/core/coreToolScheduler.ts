import type { Agent } from '../agent/Agent.js';
import type { ToolDefinition } from '../tools/types.js';
import type { BladeConfig } from '../config/types/index.js';

export class CoreToolScheduler {
  private agent: Agent;
  private config: BladeConfig;
  private toolRegistry: Map<string, ToolDefinition> = new Map();
  private executionQueue: ToolExecution[] = [];
  private isProcessing = false;
  private maxConcurrentTools: number;

  constructor(agent: Agent, config: BladeConfig) {
    this.agent = agent;
    this.config = config;
    this.maxConcurrentTools = (config as any).tools?.shell?.timeout || 5;
  }

  public async initialize(): Promise<void> {
    // 注册内置工具
    await this.registerBuiltinTools();
    
    console.log('工具调度器初始化完成');
  }

  private async registerBuiltinTools(): Promise<void> {
    // 这里应该注册核心内置工具
    // 暂时留空，后续实现
    console.log('注册内置工具');
  }

  public async registerTool(tool: ToolDefinition): Promise<void> {
    if (!tool.name || !tool.execute) {
      throw new Error('工具必须包含名称和执行函数');
    }

    if (this.toolRegistry.has(tool.name)) {
      console.warn(`工具 "${tool.name}" 已存在，将被覆盖`);
    }

    this.toolRegistry.set(tool.name, tool);
    console.log(`注册工具: ${tool.name}`);
  }

  public async unregisterTool(name: string): Promise<void> {
    if (!this.toolRegistry.has(name)) {
      throw new Error(`工具 "${name}" 未找到`);
    }

    this.toolRegistry.delete(name);
    console.log(`注销工具: ${name}`);
  }

  public async executeTool(toolName: string, params: any, options: ToolExecutionOptions = {}): Promise<any> {
    const tool = this.toolRegistry.get(toolName);
    
    if (!tool) {
      throw new Error(`工具 "${toolName}" 未找到`);
    }

    // 检查权限
    if ((tool as any).permissions && !this.checkPermissions((tool as any).permissions)) {
      throw new Error(`权限不足，无法执行工具 "${toolName}"`);
    }

    // 创建执行任务
    const execution: ToolExecution = {
      id: this.generateExecutionId(),
      toolName,
      params,
      options,
      createdAt: Date.now(),
      status: 'pending'
    };

    // 如果启用队列，添加到队列中
    if (options.queue !== false) {
      this.executionQueue.push(execution);
      return this.processQueue();
    } else {
      // 直接执行
      return this.executeToolInternal(execution);
    }
  }

  private async executeToolInternal(execution: ToolExecution): Promise<any> {
    const { toolName, params, options } = execution;
    const tool = this.toolRegistry.get(toolName);
    
    if (!tool) {
      throw new Error(`工具 "${toolName}" 未找到`);
    }

    try {
      execution.status = 'running';
      execution.startedAt = Date.now();
      
      // 设置超时
      const timeout = options.timeout || (tool as any).timeout || (this.config as any).tools?.shell?.timeout || 30000;
      
      // 执行工具
      const result = await Promise.race([
        tool.execute(params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`工具 "${toolName}" 执行超时`)), timeout)
        )
      ]);
      
      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.result = result;
      
      console.log(`工具执行完成: ${toolName} (${execution.completedAt - execution.startedAt}ms)`);
      
      return result;
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.error = error instanceof Error ? error.message : String(error);
      
      console.error(`工具执行失败: ${toolName}`, error);
      
      if (!options.suppressErrors) {
        throw error;
      }
      
      return null;
    }
  }

  private async processQueue(): Promise<any> {
    if (this.isProcessing || this.executionQueue.length === 0) {
      // 如果正在处理或队列为空，返回第一个完成的任务结果
      if (this.executionQueue.length > 0) {
        const firstExecution = this.executionQueue[0];
        if (firstExecution.status === 'completed') {
          return firstExecution.result;
        }
      }
      return null;
    }

    this.isProcessing = true;
    
    try {
      // 获取可并发执行的任务
      const concurrentExecutions = this.executionQueue.splice(0, this.maxConcurrentTools);
      
      // 并发执行任务
      const results = await Promise.all(
        concurrentExecutions.map(execution => this.executeToolInternal(execution))
      );
      
      this.isProcessing = false;
      
      // 如果还有任务，继续处理
      if (this.executionQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
      
      return results[0]; // 返回第一个任务的结果
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  public async executeTools(toolCalls: ToolCall[]): Promise<ToolExecutionResult[]> {
    try {
      // 并发执行所有工具调用
      const executions = toolCalls.map(async (call) => {
        try {
          const result = await this.executeTool(call.toolName, call.params, call.options);
          return {
            toolName: call.toolName,
            success: true,
            result,
            executionTime: 0 // 这里应该计算实际执行时间
          };
        } catch (error) {
          return {
            toolName: call.toolName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0
          };
        }
      });
      
      return Promise.all(executions);
    } catch (error) {
      console.error('批量工具执行失败:', error);
      throw error;
    }
  }

  public getTool(toolName: string): ToolDefinition | undefined {
    return this.toolRegistry.get(toolName);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.toolRegistry.values());
  }

  public getToolStatus(toolName: string): ToolStatus {
    const tool = this.toolRegistry.get(toolName);
    
    if (!tool) {
      return { registered: false };
    }
    
    const executions = this.executionQueue.filter(e => e.toolName === toolName);
    const recentExecutions = executions.slice(-10); // 最近10次执行
    
    return {
      registered: true,
      tool,
      executionCount: executions.length,
      recentExecutions,
      averageExecutionTime: this.calculateAverageExecutionTime(recentExecutions)
    };
  }

  private calculateAverageExecutionTime(executions: ToolExecution[]): number {
    if (executions.length === 0) return 0;
    
    const total = executions
      .filter(e => e.status === 'completed' && e.startedAt && e.completedAt)
      .reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0);
    
    return total / executions.length;
  }

  private checkPermissions(_requiredPermissions: string[]): boolean {
    // 这里应该实现权限检查逻辑
    // 暂时返回true，后续实现
    return true;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getQueueStatus(): ToolQueueStatus {
    return {
      queueLength: this.executionQueue.length,
      isProcessing: this.isProcessing,
      maxConcurrent: this.maxConcurrentTools,
      pendingExecutions: this.executionQueue.filter(e => e.status === 'pending'),
      runningExecutions: this.executionQueue.filter(e => e.status === 'running')
    };
  }

  public async clearQueue(): Promise<void> {
    this.executionQueue = [];
    this.isProcessing = false;
    console.log('工具执行队列已清空');
  }

  public async waitForCompletion(): Promise<void> {
    while (this.isProcessing || this.executionQueue.some(e => e.status === 'running')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// 类型定义
interface ToolExecution {
  id: string;
  toolName: string;
  params: any;
  options: ToolExecutionOptions;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

interface ToolCall {
  toolName: string;
  params: any;
  options?: ToolExecutionOptions;
}

interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

interface ToolExecutionOptions {
  timeout?: number;
  queue?: boolean;
  suppressErrors?: boolean;
  priority?: number;
}

interface ToolStatus {
  registered: boolean;
  tool?: ToolDefinition;
  executionCount?: number;
  recentExecutions?: ToolExecution[];
  averageExecutionTime?: number;
}

interface ToolQueueStatus {
  queueLength: number;
  isProcessing: boolean;
  maxConcurrent: number;
  pendingExecutions: ToolExecution[];
  runningExecutions: ToolExecution[];
}