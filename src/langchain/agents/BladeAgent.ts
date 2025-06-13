/**
 * Blade Agent - LangChain 原生 Agent 实现
 */

import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import type {
  AgentContext,
  AgentEvent,
  AgentEventTypeValue,
  AgentExecutionHistory,
  AgentPlugin,
  AgentResponse,
  AgentStats,
  AgentStatusType,
  AgentThought,
  BladeAgentAction,
  BladeAgentConfig,
  BladeAgentFinish,
  BladeAgentStep,
} from './types.js';
import { AgentEventType, AgentStatus } from './types.js';

/**
 * Blade Agent - 智能代理核心实现
 *
 * 提供完整的 LangChain Agent 功能：
 * - ReAct (推理-行动) 循环
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

    // 设置工具确认回调
    if (this.config.toolConfirmation?.enabled) {
      this.setupToolConfirmation();
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
      this.currentExecution = this.initializeExecution(executionContext, input);

      // 开始 ReAct 循环
      const result = await this.reactLoop(input, executionContext);

      // 更新统计信息
      this.updateStats(this.currentExecution);

      this.status = AgentStatus.FINISHED;
      await this.emitEvent(AgentEventType.EXECUTION_END, {
        result,
        execution: this.currentExecution,
      });

      return {
        executionId: executionContext.executionId,
        content: result.returnValues.output || result.log,
        type: 'final',
        finish: result,
        status: this.status,
        timestamp: Date.now(),
        metadata: {
          totalSteps: this.currentExecution.steps.length,
          totalTime: this.currentExecution.performance.totalTime,
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
   * ReAct (推理-行动) 循环
   */
  private async reactLoop(input: string, context: AgentContext): Promise<BladeAgentFinish> {
    const currentInput = input;
    let iteration = 0;

    // 构建初始消息
    const messages: BaseMessage[] = [];

    if (this.config.systemPrompt) {
      messages.push(new SystemMessage(this.config.systemPrompt));
    }

    messages.push(new HumanMessage(currentInput));

    while (iteration < this.config.maxIterations!) {
      iteration++;

      // 1. 思考阶段
      const thought = await this.think(messages, context);
      this.currentExecution!.thoughts.push(thought);

      // 检查是否直接给出答案
      if (!thought.plannedAction) {
        return {
          returnValues: { output: thought.content },
          log: thought.reasoning,
          reason: 'success',
          outputFormat: 'text',
        };
      }

      // 2. 行动阶段
      const action: BladeAgentAction = {
        tool: thought.plannedAction.tool,
        toolInput: thought.plannedAction.params,
        log: thought.plannedAction.reason,
      };

      const step = await this.executeAction(action, context);
      this.currentExecution!.steps.push(step);

      // 3. 观察阶段 - 将结果加入消息历史
      const observation = step.observation;
      messages.push(new AIMessage(thought.content));
      messages.push(new HumanMessage(`工具执行结果: ${observation}`));

      // 检查是否需要继续
      if (step.status === 'completed' && this.shouldFinish(observation)) {
        return {
          returnValues: { output: observation },
          log: `完成任务，经过 ${iteration} 轮思考`,
          reason: 'success',
          outputFormat: 'text',
        };
      }

      // 检查执行时间
      if (Date.now() - this.currentExecution!.startTime > this.config.maxExecutionTime!) {
        return {
          returnValues: { output: '任务执行超时' },
          log: `超时终止，经过 ${iteration} 轮思考`,
          reason: 'timeout',
          outputFormat: 'text',
        };
      }
    }

    // 达到最大迭代次数
    return {
      returnValues: { output: '达到最大思考轮数限制' },
      log: `达到最大 ${this.config.maxIterations} 轮思考限制`,
      reason: 'max_iterations',
      outputFormat: 'text',
    };
  }

  /**
   * 思考阶段
   */
  private async think(messages: BaseMessage[], _context: AgentContext): Promise<AgentThought> {
    const startTime = Date.now();

    await this.emitEvent(AgentEventType.THOUGHT_START, { messages });

    try {
      // 构建思考提示
      const thinkingPrompt = this.buildThinkingPrompt(messages);
      const thinkingMessage = new HumanMessage(thinkingPrompt);
      const allMessages = [...messages, thinkingMessage];

      // 调用 LLM 进行推理
      const response = await this.config.llm.invoke(allMessages);
      const content = typeof response === 'string' ? response : response.content.toString();

      // 解析思考结果
      const thought = this.parseThought(content, Date.now() - startTime);

      await this.emitEvent(AgentEventType.THOUGHT_END, { thought });

      return thought;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: `思考过程出错: ${errorMessage}`,
        reasoning: errorMessage,
        confidence: 0,
        thinkingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行动作
   */
  private async executeAction(
    action: BladeAgentAction,
    context: AgentContext
  ): Promise<BladeAgentStep> {
    const startTime = Date.now();

    const step: BladeAgentStep = {
      action,
      observation: '',
      status: 'pending',
      startTime,
    };

    await this.emitEvent(AgentEventType.ACTION_START, { action });

    try {
      step.status = 'executing';

      // 检查工具是否存在
      if (!this.config.toolkit.hasTool(action.tool)) {
        throw new Error(`工具不存在: ${action.tool}`);
      }

      // 工具确认
      if (this.config.toolConfirmation?.enabled) {
        const confirmed = await this.confirmToolExecution(action, context);
        if (!confirmed) {
          step.status = 'failed';
          step.error = '用户取消了工具执行';
          step.observation = '工具执行被用户取消';
          step.endTime = Date.now();
          return step;
        }
      }

      // 执行工具
      const result = await this.config.toolkit.executeTool(action.tool, action.toolInput);

      step.status = 'completed';
      step.observation = typeof result === 'string' ? result : JSON.stringify(result);
      step.endTime = Date.now();

      await this.emitEvent(AgentEventType.ACTION_END, { step });

      return step;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      step.status = 'failed';
      step.error = errorMessage;
      step.observation = `工具执行失败: ${errorMessage}`;
      step.endTime = Date.now();

      await this.emitEvent(AgentEventType.ACTION_END, { step });

      return step;
    }
  }

  /**
   * 构建思考提示
   */
  private buildThinkingPrompt(messages: BaseMessage[]): string {
    const availableTools = this.config.toolkit.listTools();

    return `
你是一个智能助手，需要通过思考和行动来解决用户的问题。

可用工具:
${availableTools}

请按以下格式思考和回答:

思考: [你的推理过程]
行动: [如果需要使用工具，描述要使用的工具和参数；如果可以直接回答，说明原因]

如果需要使用工具，请严格按照以下JSON格式:
{
  "tool": "工具名称",
  "params": {参数对象},
  "reason": "使用原因"
}

如果可以直接回答用户问题，请直接给出答案，不要使用工具。
    `.trim();
  }

  /**
   * 解析思考结果
   */
  private parseThought(content: string, thinkingTime: number): AgentThought {
    const thought: AgentThought = {
      content,
      reasoning: content,
      confidence: 0.8,
      thinkingTime,
    };

    // 尝试解析JSON格式的行动计划
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const actionPlan = JSON.parse(jsonMatch[0]);
        if (actionPlan.tool && actionPlan.params) {
          thought.plannedAction = {
            tool: actionPlan.tool,
            params: actionPlan.params,
            reason: actionPlan.reason || '未指定原因',
          };
        }
      }
    } catch (error) {
      // 解析失败，说明不需要使用工具
    }

    return thought;
  }

  /**
   * 判断是否应该结束
   */
  private shouldFinish(observation: string): boolean {
    // 简单判断逻辑，可以扩展
    const finishIndicators = ['任务完成', '已完成', '执行成功', 'success', '结果已生成'];

    return finishIndicators.some(indicator =>
      observation.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * 工具确认
   */
  private async confirmToolExecution(
    action: BladeAgentAction,
    context: AgentContext
  ): Promise<boolean> {
    const confirmationEvent: AgentEvent = {
      type: AgentEventType.TOOL_CONFIRMATION,
      executionId: context.executionId,
      data: {
        tool: action.tool,
        params: action.toolInput,
        reason: action.log,
      },
      timestamp: Date.now(),
    };

    await this.emitEvent(AgentEventType.TOOL_CONFIRMATION, confirmationEvent.data);

    // 这里应该等待用户确认，简化实现直接返回true
    // 实际实现中应该通过事件或回调等待用户输入
    return true;
  }

  /**
   * 创建执行上下文
   */
  private createExecutionContext(context?: Partial<AgentContext>): AgentContext {
    return {
      executionId: randomUUID(),
      timestamp: Date.now(),
      workingDirectory: process.cwd(),
      environment: Object.fromEntries(
        Object.entries(process.env).filter(([_, value]) => value !== undefined)
      ) as Record<string, string>,
      ...context,
    };
  }

  /**
   * 初始化执行历史
   */
  private initializeExecution(context: AgentContext, input: string): AgentExecutionHistory {
    return {
      executionId: context.executionId,
      messages: [new HumanMessage(input)],
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

  /**
   * 更新统计信息
   */
  private updateStats(execution: AgentExecutionHistory): void {
    this.stats.totalExecutions++;

    if (execution.result?.reason === 'success') {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    execution.performance.totalTime = Date.now() - execution.startTime;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) +
        execution.performance.totalTime) /
      this.stats.totalExecutions;

    // 更新工具使用统计
    execution.steps.forEach(step => {
      const toolName = step.action.tool;
      this.stats.toolUsage[toolName] = (this.stats.toolUsage[toolName] || 0) + 1;
    });

    this.stats.llmCalls += execution.thoughts.length;
  }

  /**
   * 初始化统计信息
   */
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

  /**
   * 设置工具确认
   */
  private setupToolConfirmation(): void {
    // 实现工具确认逻辑
  }

  /**
   * 发射事件
   */
  private async emitEvent(type: AgentEventTypeValue, data: any): Promise<void> {
    const event: AgentEvent = {
      type,
      executionId: this.currentExecution?.executionId || 'unknown',
      data,
      timestamp: Date.now(),
    };

    this.emit(type, event);

    // 执行插件钩子
    for (const plugin of this.plugins) {
      try {
        // 根据事件类型调用相应的钩子
        // 这里可以扩展更复杂的插件系统
      } catch (error) {
        if (this.config.debug) {
          console.error(`插件 ${plugin.name} 处理事件失败:`, error);
        }
      }
    }
  }

  /**
   * 获取当前状态
   */
  public getStatus(): AgentStatusType {
    return this.status;
  }

  /**
   * 获取执行历史
   */
  public getExecutionHistory(): AgentExecutionHistory | undefined {
    return this.currentExecution;
  }

  /**
   * 获取统计信息
   */
  public getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * 添加插件
   */
  public addPlugin(plugin: AgentPlugin): void {
    this.plugins.push(plugin);
  }

  /**
   * 移除插件
   */
  public removePlugin(pluginName: string): boolean {
    const index = this.plugins.findIndex(p => p.name === pluginName);
    if (index >= 0) {
      this.plugins.splice(index, 1);
      return true;
    }
    return false;
  }
}
