/**
 * 子Agent注册器 - 管理所有子Agent
 */

import { EventEmitter } from 'events';
import type { BladeConfig } from '../config/types/index.js';
import type { MainAgent } from './MainAgent.js';

export interface SubAgentDefinition {
  name: string;
  description: string;
  capabilities: string[];
  specialization: string;
  priority: number;
  maxConcurrentTasks: number;
}

export interface SubAgentInstance {
  definition: SubAgentDefinition;
  instance: BaseSubAgent;
  isActive: boolean;
  currentTasks: number;
  totalTasksExecuted: number;
  lastUsed: number;
}

export interface TaskRequest {
  id: string;
  type: string;
  prompt: string;
  context?: any;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  taskId: string;
  agentName: string;
  content: any;
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * 基础子Agent接口
 */
export abstract class BaseSubAgent extends EventEmitter {
  protected name: string;
  protected description: string;
  protected capabilities: string[];
  protected parentAgent: MainAgent;
  protected config: BladeConfig;
  protected isInitialized = false;

  constructor(
    name: string,
    description: string,
    capabilities: string[],
    parentAgent: MainAgent,
    config: BladeConfig
  ) {
    super();
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.parentAgent = parentAgent;
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.onInitialize();
    this.isInitialized = true;
    this.emit('initialized');
  }

  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.onDestroy();
    this.isInitialized = false;
    this.removeAllListeners();
    this.emit('destroyed');
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

  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 执行任务 - 子类必须实现
   */
  public abstract executeTask(task: TaskRequest): Promise<TaskResult>;

  /**
   * 检查是否能处理任务
   */
  public abstract canHandle(task: TaskRequest): boolean;

  /**
   * 子类初始化钩子
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * 子类销毁钩子
   */
  protected abstract onDestroy(): Promise<void>;

  /**
   * 获取父Agent的上下文管理器
   */
  protected getContextManager() {
    return this.parentAgent.getContextManager();
  }

  /**
   * 记录日志
   */
  protected log(message: string, data?: any): void {
    console.log(`[SubAgent:${this.name}] ${message}`, data || '');
  }

  /**
   * 记录错误
   */
  protected error(message: string, error?: any): void {
    console.error(`[SubAgent:${this.name}] ${message}`, error || '');
  }
}

/**
 * 子Agent注册器
 */
export class SubAgentRegistry extends EventEmitter {
  private agents = new Map<string, SubAgentInstance>();
  private parentAgent: MainAgent;
  private isInitialized = false;

  constructor(parentAgent: MainAgent) {
    super();
    this.parentAgent = parentAgent;
  }

  /**
   * 初始化注册器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log('初始化子Agent注册器...');

      // 注册内置子Agent
      await this.registerBuiltinAgents();

      this.isInitialized = true;
      this.log('子Agent注册器初始化完成');
      this.emit('initialized');
    } catch (error) {
      this.error('子Agent注册器初始化失败', error);
      throw error;
    }
  }

  /**
   * 销毁注册器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.log('销毁子Agent注册器...');

      // 销毁所有子Agent
      for (const [name, agentInstance] of this.agents) {
        await this.unregisterAgent(name);
      }

      this.isInitialized = false;
      this.removeAllListeners();
      this.log('子Agent注册器已销毁');
    } catch (error) {
      this.error('子Agent注册器销毁失败', error);
      throw error;
    }
  }

  /**
   * 注册子Agent
   */
  public async registerAgent(
    definition: SubAgentDefinition,
    agentClass: new (...args: any[]) => BaseSubAgent
  ): Promise<void> {
    if (this.agents.has(definition.name)) {
      throw new Error(`子Agent "${definition.name}" 已存在`);
    }

    try {
      // 创建子Agent实例
      const instance = new agentClass(
        definition.name,
        definition.description,
        definition.capabilities,
        this.parentAgent,
        this.parentAgent['config']
      );

      // 初始化子Agent
      await instance.initialize();

      // 注册到映射表
      this.agents.set(definition.name, {
        definition,
        instance,
        isActive: true,
        currentTasks: 0,
        totalTasksExecuted: 0,
        lastUsed: Date.now(),
      });

      this.log(`子Agent "${definition.name}" 注册成功`);
      this.emit('agentRegistered', definition.name);
    } catch (error) {
      this.error(`注册子Agent "${definition.name}" 失败`, error);
      throw error;
    }
  }

  /**
   * 注销子Agent
   */
  public async unregisterAgent(name: string): Promise<boolean> {
    const agentInstance = this.agents.get(name);
    if (!agentInstance) {
      return false;
    }

    try {
      // 销毁子Agent
      await agentInstance.instance.destroy();

      // 从映射表移除
      this.agents.delete(name);

      this.log(`子Agent "${name}" 注销成功`);
      this.emit('agentUnregistered', name);
      return true;
    } catch (error) {
      this.error(`注销子Agent "${name}" 失败`, error);
      throw error;
    }
  }

  /**
   * 获取子Agent
   */
  public getAgent(name: string): BaseSubAgent | undefined {
    const agentInstance = this.agents.get(name);
    return agentInstance?.instance;
  }

  /**
   * 执行任务 - 通过指定的子Agent或自动选择最佳子Agent
   */
  public async executeTask(agentName: string | undefined, task: TaskRequest): Promise<TaskResult> {
    let agent: BaseSubAgent | undefined;

    if (agentName) {
      agent = this.getAgent(agentName);
      if (!agent) {
        throw new Error(`子Agent "${agentName}" 未找到`);
      }
    } else {
      agent = this.findBestAgent(task);
      if (!agent) {
        throw new Error('没有可用的子Agent来处理此任务');
      }
    }

    // 更新Agent状态
    const agentInstance = this.agents.get(agent.getName());
    if (agentInstance) {
      agentInstance.currentTasks++;
      agentInstance.lastUsed = Date.now();
    }

    try {
      const result = await agent.executeTask(task);

      // 更新统计信息
      if (agentInstance) {
        agentInstance.currentTasks--;
        agentInstance.totalTasksExecuted++;
      }

      return result;
    } catch (error) {
      // 恢复任务计数
      if (agentInstance) {
        agentInstance.currentTasks--;
      }
      throw error;
    }
  }

  /**
   * 查找最适合的子Agent
   */
  public findBestAgent(task: TaskRequest): BaseSubAgent | undefined {
    let bestAgent: BaseSubAgent | undefined;
    let bestScore = 0;

    for (const [name, agentInstance] of this.agents) {
      if (!agentInstance.isActive || !agentInstance.instance.canHandle(task)) {
        continue;
      }

      // 计算匹配分数
      const score = this.calculateMatchScore(agentInstance, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agentInstance.instance;
      }
    }

    return bestAgent;
  }

  /**
   * 计算子Agent与任务的匹配分数
   */
  private calculateMatchScore(agentInstance: SubAgentInstance, task: TaskRequest): number {
    let score = 0;

    // 基础优先级分数
    score += agentInstance.definition.priority;

    // 负载均衡分数（任务越少分数越高）
    const loadFactor = 1 - agentInstance.currentTasks / agentInstance.definition.maxConcurrentTasks;
    score += loadFactor * 10;

    // 最近使用分数（越久未使用分数越高，鼓励负载均衡）
    const timeSinceLastUse = Date.now() - agentInstance.lastUsed;
    score += Math.min(timeSinceLastUse / 60000, 5); // 最多5分

    return score;
  }

  /**
   * 获取所有子Agent信息
   */
  public getAllAgents(): SubAgentDefinition[] {
    return Array.from(this.agents.values()).map(instance => instance.definition);
  }

  /**
   * 获取子Agent状态
   */
  public getAgentStatus(name: string): SubAgentInstance | undefined {
    return this.agents.get(name);
  }

  /**
   * 获取注册器统计信息
   */
  public getStats() {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(a => a.isActive).length;
    const totalTasks = Array.from(this.agents.values()).reduce(
      (sum, a) => sum + a.totalTasksExecuted,
      0
    );

    return {
      totalAgents,
      activeAgents,
      totalTasks,
      agentNames: Array.from(this.agents.keys()),
    };
  }

  /**
   * 注册内置子Agent
   */
  private async registerBuiltinAgents(): Promise<void> {
    // 这里将注册内置的子Agent
    // 暂时留空，后续实现具体的子Agent类
    this.log('注册内置子Agent...');
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: any): void {
    console.log(`[SubAgentRegistry] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: any): void {
    console.error(`[SubAgentRegistry] ${message}`, error || '');
  }
}
