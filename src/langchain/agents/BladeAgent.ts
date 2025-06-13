/**
 * Blade Agent - LangChain 原生 Agent 实现
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { BladeToolkit } from '../tools/BladeToolkit.js';

import type {
  AgentContext,
  AgentEvent,
  AgentEventTypeValue,
  AgentExecutionHistory,
  AgentPlugin,
  AgentResponse,
  AgentStats,
  AgentStatusType,
  BladeAgentConfig,
} from './types.js';
import { AgentEventType, AgentStatus } from './types.js';

/**
 * Blade Agent - 智能代理核心实现
 *
 * 使用 LangChain 原生 Agent 功能：
 * - 原生 ReAct Agent (createReactAgent)
 * - AgentExecutor 管理
 * - 工具调用和确认
 * - 记忆管理
 * - 插件系统
 * - 事件驱动架构
 */
export class BladeAgent extends EventEmitter {
  private config: BladeAgentConfig;
  private status: AgentStatusType = AgentStatus.IDLE;
  private currentExecution?: AgentExecutionHistory;
  private plugins: AgentPlugin[] = [];
  private stats: AgentStats;
  private agentExecutor?: AgentExecutor;

  constructor(config: BladeAgentConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();

    // 设置默认配置
    this.config = {
      maxIterations: 10,
      maxExecutionTime: 300000, // 5分钟
      streaming: false,
      debug: false,
      ...config,
    };

    // 初始化 LangChain Agent
    this.initializeLangChainAgent();

    // 设置工具确认回调
    if (this.config.toolConfirmation?.enabled) {
      this.setupToolConfirmation();
    }
  }

  /**
   * 初始化 LangChain Agent Executor
   */
  private async initializeLangChainAgent(): Promise<void> {
    const tools = this.config.toolkit?.toLangChainTools() || [];

    // 创建提示模板
    const prompt = await this.createPromptTemplate();

    // 创建 ReAct Agent
    const agent = await createReactAgent({
      llm: this.config.llm!,
      tools,
      prompt,
    });

    // 创建 Agent Executor
    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      maxIterations: this.config.maxIterations,
      verbose: this.config.debug,
      handleParsingErrors: true,
    });
  }

  /**
   * 创建提示模板
   */
  private async createPromptTemplate(): Promise<PromptTemplate> {
    try {
      // 尝试从 LangChain Hub 拉取标准 ReAct 提示模板
      return await pull('hwchase17/react');
    } catch {
      // 如果失败，使用自定义提示模板
      const template = `${this.config.systemPrompt || '你是一个智能助手，可以使用工具来帮助用户解决问题。'}

你有权访问以下工具：

{tools}

使用以下格式：

Question: 用户输入的问题
Thought: 我需要思考该怎么做
Action: 要使用的工具，应该是 [{tool_names}] 中的一个
Action Input: 工具的输入参数
Observation: 工具执行的结果
... (这个Thought/Action/Action Input/Observation序列可以重复N次)
Thought: 我现在知道最终答案了
Final Answer: 对原始输入问题的最终答案

开始!

Question: {input}
Thought:{agent_scratchpad}`;

      return PromptTemplate.fromTemplate(template);
    }
  }

  /**
   * 执行对话任务
   */
  public async invoke(input: string, context?: Partial<AgentContext>): Promise<AgentResponse> {
    const executionContext = this.createExecutionContext(context);

    try {
      this.status = AgentStatus.THINKING;
      await this.emitEvent(AgentEventType.EXECUTION_START, {
        input,
        context: executionContext,
      });

      // 初始化执行历史
      this.currentExecution = this.initializeExecution(executionContext);

      // 确保 AgentExecutor 已初始化
      if (!this.agentExecutor) {
        await this.initializeLangChainAgent();
      }

      // 使用 LangChain Agent Executor 执行
      const result = await this.agentExecutor!.invoke({
        input,
      });

      // 更新统计信息
      this.updateStats(this.currentExecution);

      this.status = AgentStatus.FINISHED;
      await this.emitEvent(AgentEventType.EXECUTION_END, {
        result,
        execution: this.currentExecution,
      });

      return {
        executionId: executionContext.executionId,
        content: result.output || '任务完成',
        type: 'final',
        finish: {
          returnValues: { output: result.output },
          log: result.log || '',
          reason: 'success',
          outputFormat: 'text',
        },
        status: this.status,
        timestamp: Date.now(),
        metadata: {
          totalSteps: this.currentExecution.steps.length,
          totalTime: this.currentExecution.performance.totalTime,
          intermediateSteps: result.intermediateSteps,
        },
      };
    } catch (error) {
      this.status = AgentStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.emitEvent(AgentEventType.ERROR, {
        error: errorMessage,
        context: executionContext,
      });

      return {
        executionId: executionContext.executionId,
        content: `执行错误: ${errorMessage}`,
        type: 'error',
        status: this.status,
        timestamp: Date.now(),
        metadata: { error: errorMessage },
      };
    }
  }

  /**
   * 流式执行对话任务
   */
  public async *stream(
    input: string,
    context?: Partial<AgentContext>
  ): AsyncGenerator<AgentResponse> {
    const executionContext = this.createExecutionContext(context);

    try {
      this.status = AgentStatus.THINKING;
      await this.emitEvent(AgentEventType.EXECUTION_START, {
        input,
        context: executionContext,
      });

      // 初始化执行历史
      this.currentExecution = this.initializeExecution(executionContext);

      // 确保 AgentExecutor 已初始化
      if (!this.agentExecutor) {
        await this.initializeLangChainAgent();
      }

      // 使用 LangChain Agent Executor 流式执行
      const stream = await this.agentExecutor!.stream({
        input,
      });

      for await (const chunk of stream) {
        if (chunk.intermediateSteps) {
          // 处理中间步骤
          yield {
            executionId: executionContext.executionId,
            content: `执行中: ${JSON.stringify(chunk.intermediateSteps)}`,
            type: 'action',
            status: AgentStatus.THINKING,
            timestamp: Date.now(),
            metadata: { chunk },
          };
        }

        if (chunk.output) {
          // 最终结果
          yield {
            executionId: executionContext.executionId,
            content: chunk.output,
            type: 'final',
            status: AgentStatus.FINISHED,
            timestamp: Date.now(),
            metadata: { chunk },
          };
        }
      }

      this.status = AgentStatus.FINISHED;
      await this.emitEvent(AgentEventType.EXECUTION_END, {
        execution: this.currentExecution,
      });
    } catch (error) {
      this.status = AgentStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.emitEvent(AgentEventType.ERROR, {
        error: errorMessage,
        context: executionContext,
      });

      yield {
        executionId: executionContext.executionId,
        content: `执行错误: ${errorMessage}`,
        type: 'error',
        status: this.status,
        timestamp: Date.now(),
        metadata: { error: errorMessage },
      };
    }
  }

  // ======================== 插件和工具管理 ========================

  /**
   * 获取工具包
   */
  public getToolkit(): BladeToolkit {
    return this.config.toolkit;
  }

  // ======================== 辅助方法 ========================

  private createExecutionContext(context?: Partial<AgentContext>): AgentContext {
    return {
      executionId: randomUUID(),
      sessionId: context?.sessionId || randomUUID(),
      userId: context?.userId || 'anonymous',
      timestamp: Date.now(),
      ...context,
    };
  }

  private initializeExecution(context: AgentContext): AgentExecutionHistory {
    return {
      executionId: context.executionId,
      messages: [],
      steps: [],
      thoughts: [],
      startTime: Date.now(),
      status: AgentStatus.THINKING,
      performance: {
        totalTime: 0,
        thinkingTime: 0,
        actionTime: 0,
        llmCalls: 0,
        toolCalls: 0,
      },
    };
  }

  private updateStats(execution: AgentExecutionHistory): void {
    this.stats.totalExecutions++;
    this.stats.successfulExecutions++;

    // 计算执行时间
    execution.performance.totalTime = Date.now() - execution.startTime;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) +
        execution.performance.totalTime) /
      this.stats.totalExecutions;

    this.stats.llmCalls += execution.thoughts.length;
  }

  private initializeStats(): AgentStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      toolUsage: {},
      llmCalls: 0,
      totalTokens: 0,
    };
  }

  private setupToolConfirmation(): void {
    // 设置工具确认回调
    // 这里可以根据需要实现
  }

  private async emitEvent(type: AgentEventTypeValue, data: any): Promise<void> {
    const event: AgentEvent = {
      type,
      executionId: this.currentExecution?.executionId || 'unknown',
      timestamp: Date.now(),
      data,
    };

    // 异步触发插件处理
    for (const plugin of this.plugins) {
      try {
        // 使用具体的插件钩子而非通用的 onEvent
        if (type === AgentEventType.EXECUTION_START) {
          await plugin.beforeExecution?.(data.context);
        } else if (type === AgentEventType.EXECUTION_END) {
          await plugin.afterExecution?.(data.context, data.result);
        } else if (type === AgentEventType.ERROR) {
          await plugin.onError?.(data.context, new Error(data.error));
        }
      } catch (error) {
        if (this.config.debug) {
          console.error(`Plugin ${plugin.name} error:`, error);
        }
      }
    }

    this.emit(type, event);
  }

  // ======================== 公共方法 ========================

  public getStatus(): AgentStatusType {
    return this.status;
  }

  public getExecutionHistory(): AgentExecutionHistory | undefined {
    return this.currentExecution;
  }

  public getStats(): AgentStats {
    return { ...this.stats };
  }

  public addPlugin(plugin: AgentPlugin): void {
    this.plugins.push(plugin);
  }

  public removePlugin(pluginName: string): boolean {
    const index = this.plugins.findIndex(p => p.name === pluginName);
    if (index !== -1) {
      this.plugins.splice(index, 1);
      return true;
    }
    return false;
  }
}
