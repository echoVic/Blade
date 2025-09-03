import type { Agent } from '../agent/Agent.js';
import type { BladeConfig } from '../config/types/index.js';
import type { ToolDefinition } from '../tools/types.js';

export class SubAgent {
  private parentAgent: Agent;
  private config: BladeConfig;
  private name: string;
  private description: string;
  private capabilities: string[];
  private tools: Map<string, ToolDefinition> = new Map();
  private isActive = false;
  private taskHistory: SubAgentTask[] = [];
  private maxHistorySize: number;

  constructor(
    parentAgent: Agent,
    config: BladeConfig,
    options: SubAgentOptions
  ) {
    this.parentAgent = parentAgent;
    this.config = config;
    this.name = options.name;
    this.description = options.description;
    this.capabilities = options.capabilities || [];
    this.maxHistorySize = options.maxHistorySize || 100;
  }

  public async initialize(): Promise<void> {
    // 初始化子代理
    this.isActive = true;
    
    // 注册默认工具
    await this.registerDefaultTools();
    
    console.log(`子代理 "${this.name}" 初始化完成`);
  }

  private async registerDefaultTools(): Promise<void> {
    // 这里应该注册子代理的默认工具
    // 暂时留空，后续实现
    console.log(`注册子代理 "${this.name}" 的默认工具`);
  }

  public async executeTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    try {
      // 创建任务记录
      const taskRecord: SubAgentTask = {
        id: this.generateTaskId(),
        type: task.type,
        prompt: task.prompt,
        toolName: task.toolName,
        toolParams: task.toolParams,
        options: task.options,
        status: 'pending',
        createdAt: Date.now()
      };
      
      this.taskHistory.push(taskRecord);
      
      // 限制历史记录大小
      if (this.taskHistory.length > this.maxHistorySize) {
        this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
      }
      
      // 执行任务
      taskRecord.status = 'running';
      taskRecord.startedAt = Date.now();
      
      const result = await this.processTask(task);
      
      taskRecord.status = 'completed';
      taskRecord.completedAt = Date.now();
      taskRecord.result = result;
      taskRecord.executionTime = taskRecord.completedAt - taskRecord.startedAt;
      
      console.log(`子代理 "${this.name}" 任务执行完成 (${taskRecord.executionTime}ms)`);
      
      return result;
    } catch (error) {
      console.error(`子代理 "${this.name}" 任务执行失败:`, error);
      
      // 更新任务记录
      const lastTask = this.taskHistory[this.taskHistory.length - 1];
      if (lastTask) {
        lastTask.status = 'failed';
        lastTask.completedAt = Date.now();
        lastTask.error = error instanceof Error ? error.message : String(error);
      }
      
      throw error;
    }
  }

  private async processTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    // 根据任务类型处理
    switch (task.type) {
      case 'chat':
        return this.processChatTask(task);
      
      case 'tool':
        return this.processToolTask(task);
      
      case 'code':
        return this.processCodeTask(task);
      
      case 'analysis':
        return this.processAnalysisTask(task);
      
      default:
        throw new Error(`不支持的任务类型: ${task.type}`);
    }
  }

  private async processChatTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    const prompt = `作为${this.description}专家，${task.prompt}`;
    
    const response = await this.parentAgent.chat(prompt);
    
    return {
      taskId: task.id,
      type: 'chat',
      content: response,
      metadata: {
        agent: this.name,
        taskType: task.type
      }
    };
  }

  private async processToolTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    if (!task.toolName) {
      throw new Error('工具任务必须指定工具名称');
    }
    
    const tool = this.tools.get(task.toolName);
    if (!tool) {
      throw new Error(`工具 "${task.toolName}" 未找到`);
    }
    
    const result = await tool.execute(task.toolParams || {});
    
    return {
      taskId: task.id,
      type: 'tool',
      content: result,
      metadata: {
        agent: this.name,
        taskType: task.type,
        toolName: task.toolName
      }
    };
  }

  private async processCodeTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    const prompt = `作为${this.description}专家，请${task.prompt}`;
    
    const code = await this.parentAgent.chat(prompt);
    
    return {
      taskId: task.id,
      type: 'code',
      content: code,
      metadata: {
        agent: this.name,
        taskType: task.type
      }
    };
  }

  private async processAnalysisTask(task: SubAgentTaskRequest): Promise<SubAgentTaskResult> {
    const prompt = `作为${this.description}专家，请分析以下内容:\n\n${task.prompt}`;
    
    const analysis = await this.parentAgent.chat(prompt);
    
    return {
      taskId: task.id,
      type: 'analysis',
      content: analysis,
      metadata: {
        agent: this.name,
        taskType: task.type
      }
    };
  }

  public async registerTool(tool: ToolDefinition): Promise<void> {
    if (!tool.name || !tool.execute) {
      throw new Error('工具必须包含名称和执行函数');
    }

    if (this.tools.has(tool.name)) {
      console.warn(`工具 "${tool.name}" 已存在，将被覆盖`);
    }

    this.tools.set(tool.name, tool);
    console.log(`子代理 "${this.name}" 注册工具: ${tool.name}`);
  }

  public async unregisterTool(name: string): Promise<void> {
    if (!this.tools.has(name)) {
      throw new Error(`工具 "${name}" 未找到`);
    }

    this.tools.delete(name);
    console.log(`子代理 "${this.name}" 注销工具: ${name}`);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getName(): string {
    return this.name;
  }

  public getDescription(): string {
    return this.description;
  }

  public getCapabilities(): string[] {
    return [...this.capabilities];
  }

  public isActiveAgent(): boolean {
    return this.isActive;
  }

  public getTaskHistory(limit: number = 50): SubAgentTask[] {
    return this.taskHistory.slice(-limit);
  }

  public getTaskStats(): SubAgentTaskStats {
    const totalTasks = this.taskHistory.length;
    const completedTasks = this.taskHistory.filter(t => t.status === 'completed').length;
    const failedTasks = this.taskHistory.filter(t => t.status === 'failed').length;
    
    const executionTimes = this.taskHistory
      .filter(t => t.status === 'completed' && t.executionTime)
      .map(t => t.executionTime!);
    
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;
    
    return {
      totalTasks,
      completedTasks,
      failedTasks,
      successRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      averageExecutionTime,
      activeTasks: this.taskHistory.filter(t => t.status === 'running').length
    };
  }

  public async destroy(): Promise<void> {
    this.isActive = false;
    this.tools.clear();
    this.taskHistory = [];
    console.log(`子代理 "${this.name}" 已销毁`);
  }

  private generateTaskId(): string {
    return `task_${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 专门的子代理实现
export class CodeSubAgent extends SubAgent {
  constructor(parentAgent: Agent, config: BladeConfig) {
    super(parentAgent, config, {
      name: 'code-agent',
      description: '代码生成和分析专家',
      capabilities: ['code-generation', 'code-review', 'bug-fixing', 'optimization']
    });
  }
}

export class GitSubAgent extends SubAgent {
  constructor(parentAgent: Agent, config: BladeConfig) {
    super(parentAgent, config, {
      name: 'git-agent',
      description: 'Git版本控制专家',
      capabilities: ['commit-message', 'branch-management', 'merge-conflicts', 'history-analysis']
    });
  }
}

export class TestSubAgent extends SubAgent {
  constructor(parentAgent: Agent, config: BladeConfig) {
    super(parentAgent, config, {
      name: 'test-agent',
      description: '测试专家',
      capabilities: ['test-generation', 'test-execution', 'coverage-analysis', 'bug-reproduction']
    });
  }
}

export class DocumentationSubAgent extends SubAgent {
  constructor(parentAgent: Agent, config: BladeConfig) {
    super(parentAgent, config, {
      name: 'docs-agent',
      description: '文档专家',
      capabilities: ['api-documentation', 'user-guides', 'tutorials', 'technical-writing']
    });
  }
}

// 类型定义
interface SubAgentOptions {
  name: string;
  description: string;
  capabilities?: string[];
  maxHistorySize?: number;
}

interface SubAgentTaskRequest {
  id: string;
  type: 'chat' | 'tool' | 'code' | 'analysis';
  prompt: string;
  toolName?: string;
  toolParams?: any;
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

interface SubAgentTaskResult {
  taskId: string;
  type: string;
  content: any;
  metadata?: Record<string, any>;
}

interface SubAgentTask {
  id: string;
  type: string;
  prompt: string;
  toolName?: string;
  toolParams?: any;
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  executionTime?: number;
  result?: SubAgentTaskResult;
  error?: string;
}

interface SubAgentTaskStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  averageExecutionTime: number;
  activeTasks: number;
}