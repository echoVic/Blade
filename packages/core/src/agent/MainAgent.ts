/**
 * 主Agent - 基于Claude Code设计的全新架构
 * 负责任务规划、协调子Agent和结果整合
 */

import { EventEmitter } from 'events';
import type { BladeConfig } from '../config/types/index.js';
import { createLLMContextManager, type LLMContextManager } from '../llm/index.js';
import type { LLMMessage } from '../llm/types.js';
import { SteeringController } from './SteeringController.js';
import { SubAgentRegistry } from './SubAgentRegistry.js';
import { AnalysisAgent } from './subagents/AnalysisAgent.js';
import { CodeAgent } from './subagents/CodeAgent.js';
import { TaskPlanner } from './TaskPlanner.js';

export interface AgentTask {
  id: string;
  type: 'simple' | 'complex' | 'recursive';
  prompt: string;
  context?: Record<string, unknown>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  taskId: string;
  content: string;
  subAgentResults?: SubAgentResult[];
  executionPlan?: ExecutionStep[];
  metadata?: Record<string, unknown>;
}

export interface SubAgentResult {
  agentName: string;
  taskType: string;
  result: unknown;
  executionTime: number;
}

export interface ExecutionStep {
  id: string;
  type: 'llm' | 'tool' | 'subagent';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 主Agent类 - 全新Claude Code风格的智能代理
 */
export class MainAgent extends EventEmitter {
  private config: BladeConfig;
  private isInitialized = false;
  private activeTask?: AgentTask;

  // 新架构核心组件
  private contextManager!: LLMContextManager;
  private subAgentRegistry!: SubAgentRegistry;
  private taskPlanner!: TaskPlanner;
  private steeringController!: SteeringController;

  constructor(config: BladeConfig) {
    super();
    this.config = config;

    // 注意：这些组件将在 initialize() 方法中异步初始化
  }

  /**
   * 初始化主Agent
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log('初始化新架构主Agent...');

      // 初始化核心组件
      this.contextManager = await createLLMContextManager(this.config);
      this.subAgentRegistry = new SubAgentRegistry(this);
      this.taskPlanner = new TaskPlanner(this.config);
      this.steeringController = new SteeringController(this.config);

      // 初始化其他组件
      await this.subAgentRegistry.initialize();
      await this.taskPlanner.initialize();
      await this.steeringController.initialize();

      // 注册内置子Agent
      await this.registerBuiltinSubAgents();

      this.isInitialized = true;
      this.log('新架构主Agent初始化完成');
      this.emit('initialized');
    } catch (error) {
      this.error('主Agent初始化失败', error);
      throw error;
    }
  }

  /**
   * 注册内置子Agent
   */
  private async registerBuiltinSubAgents(): Promise<void> {
    // 注册代码专家Agent
    await this.subAgentRegistry.registerAgent(
      {
        name: 'code-agent',
        description: '代码生成和分析专家',
        capabilities: ['code-generation', 'code-review', 'debugging'],
        specialization: 'programming',
        maxConcurrentTasks: 3,
        priority: 8,
      },
      CodeAgent
    );

    // 注册分析专家Agent
    await this.subAgentRegistry.registerAgent(
      {
        name: 'analysis-agent',
        description: '数据分析和研究专家',
        capabilities: ['data-analysis', 'research', 'comparison'],
        specialization: 'analysis',
        maxConcurrentTasks: 2,
        priority: 7,
      },
      AnalysisAgent
    );

    this.log('内置子Agent注册完成');
  }

  /**
   * 执行任务 - 智能分析并选择执行策略
   */
  public async executeTask(task: AgentTask): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('MainAgent未初始化');
    }

    this.activeTask = task;
    this.emit('taskStarted', task);

    try {
      this.log(`开始执行任务: ${task.id}`);

      // 1. 智能任务规划
      const executionPlan = await this.taskPlanner.planTask(task);
      this.log(`生成执行计划，共${executionPlan.length}步`);

      // 2. 实时Steering分析
      const steeringResult = await this.steeringController.analyzeTask(task);
      this.log(`Steering分析完成，置信度: ${steeringResult.confidence}`);

      // 3. 执行计划
      const subAgentResults: SubAgentResult[] = [];
      let hasFailedSteps = false;
      let lastError: Error | null = null;

      for (const step of executionPlan) {
        step.status = 'running';

        try {
          if (step.type === 'subagent') {
            const result = await this.executeSubAgentStep(step, task);
            subAgentResults.push(result);
            step.result = result;
            step.status = 'completed';
          } else if (step.type === 'llm') {
            const result = await this.executeLLMStep(step, task);
            step.result = result;
            step.status = 'completed';
          }
        } catch (error) {
          step.error = error instanceof Error ? error.message : String(error);
          step.status = 'failed';
          hasFailedSteps = true;
          lastError = error instanceof Error ? error : new Error(String(error));
          this.error(`执行步骤失败: ${step.id}`, error);

          // 如果是关键步骤（如LLM调用）失败，应该停止执行
          if (step.type === 'llm') {
            this.error(`关键步骤失败，停止任务执行: ${step.id}`, error);
            break;
          }
        }
      }

      // 如果有关键步骤失败，抛出异常
      if (hasFailedSteps && lastError) {
        throw lastError;
      }

      // 4. 整合结果
      const response: AgentResponse = {
        taskId: task.id,
        content: await this.integrateResults(task, executionPlan, subAgentResults),
        subAgentResults,
        executionPlan,
        metadata: {
          executionMode: 'intelligent',
          taskType: task.type,
          steeringResult,
          planSteps: executionPlan.length,
        },
      };

      this.activeTask = undefined;
      this.emit('taskCompleted', task, response);
      this.log(`任务执行完成: ${task.id}`);

      return response;
    } catch (error) {
      this.activeTask = undefined;
      this.emit('taskFailed', task, error);
      this.error(`任务执行失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 执行子Agent步骤
   */
  private async executeSubAgentStep(step: ExecutionStep, task: AgentTask): Promise<SubAgentResult> {
    const agentName = step.metadata?.agentName as string;
    if (!agentName) {
      throw new Error('SubAgent步骤缺少agentName');
    }

    const startTime = Date.now();
    const result = await this.subAgentRegistry.executeTask(agentName, {
      id: `${task.id}_${step.id}`,
      type: 'chat',
      prompt: task.prompt,
      context: task.context,
    });

    const executionTime = Date.now() - startTime;

    return {
      agentName,
      taskType: result.agentName,
      result: result.content,
      executionTime,
    };
  }

  /**
   * 执行LLM步骤
   */
  private async executeLLMStep(step: ExecutionStep, task: AgentTask): Promise<string> {
    const messages: LLMMessage[] = [{ role: 'user', content: task.prompt }];

    const response = await this.contextManager.processConversation(messages);
    return response;
  }

  /**
   * 整合执行结果
   */
  private async integrateResults(
    task: AgentTask,
    executionPlan: ExecutionStep[],
    subAgentResults: SubAgentResult[]
  ): Promise<string> {
    // 简化的结果整合逻辑
    if (subAgentResults.length === 0) {
      // 直接LLM处理的结果
      const llmStep = executionPlan.find(s => s.type === 'llm' && s.status === 'completed');
      return (llmStep?.result as string) || '处理完成';
    }

    // 多Agent协作的结果整合
    const results = subAgentResults.map(r => `${r.agentName}: ${r.result}`).join('\n\n');
    return `多Agent协作结果:\n\n${results}`;
  }

  /**
   * 简单聊天接口 - 智能路由
   */
  public async chat(message: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('MainAgent未初始化');
    }

    const task: AgentTask = {
      id: this.generateTaskId(),
      type: 'simple',
      prompt: message,
    };

    const response = await this.executeTask(task);
    return response.content;
  }

  /**
   * 系统提示词聊天
   */
  public async chatWithSystem(systemPrompt: string, userMessage: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.contextManager.processConversation(messages);
    return response;
  }

  /**
   * 多轮对话
   */
  public async conversation(messages: LLMMessage[]): Promise<string> {
    const response = await this.contextManager.processConversation(messages);
    return response;
  }

  /**
   * 获取当前活动任务
   */
  public getActiveTask(): AgentTask | undefined {
    return this.activeTask;
  }

  /**
   * 获取子Agent注册器
   */
  public getSubAgentRegistry(): SubAgentRegistry {
    return this.subAgentRegistry;
  }

  /**
   * 获取上下文管理器
   */
  public getContextManager(): LLMContextManager {
    return this.contextManager;
  }

  /**
   * 获取任务规划器
   */
  public getTaskPlanner(): TaskPlanner {
    return this.taskPlanner;
  }

  /**
   * 获取Steering控制器
   */
  public getSteeringController(): SteeringController {
    return this.steeringController;
  }

  /**
   * 销毁Agent
   */
  public async destroy(): Promise<void> {
    this.log('销毁新架构主Agent...');

    try {
      // 销毁核心组件
      if (this.contextManager) {
        await this.contextManager.destroy();
      }
      if (this.subAgentRegistry) {
        await this.subAgentRegistry.destroy();
      }
      if (this.taskPlanner) {
        await this.taskPlanner.destroy();
      }
      if (this.steeringController) {
        await this.steeringController.destroy();
      }

      this.removeAllListeners();
      this.isInitialized = false;
      this.log('新架构主Agent已销毁');
    } catch (error) {
      this.error('主Agent销毁失败', error);
      throw error;
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: unknown): void {
    console.log(`[MainAgent] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: unknown): void {
    console.error(`[MainAgent] ${message}`, error || '');
  }
}
