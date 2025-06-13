/**
 * Blade Chains - LangChain 集成
 * 智能链式处理系统，提供工作流编排和自动化执行
 */

import { LangChainMemoryManager } from '../memory/LangChainMemoryManager.js';
import { MemoryType } from '../memory/types.js';
import { BladeTool } from '../tools/base/BladeTool.js';
import {
  ChainBuilder,
  ChainConfig,
  ChainContext,
  ChainDefinition,
  ChainExecutionEvent,
  ChainExecutionListener,
  ChainExecutionResult,
  ChainExecutionStatus,
  ChainExecutor,
  ChainRegistry,
  ChainStep,
  ChainValidationResult,
  ConditionStepConfig,
  ParallelStepConfig,
  PromptStepConfig,
  SequenceStepConfig,
  StepExecutionResult,
  ToolStepConfig,
  TransformStepConfig,
} from './types.js';

/**
 * Blade Chains 主类
 * 提供完整的链式处理功能，集成 LangChain memory
 */
export class BladeChains implements ChainExecutor, ChainRegistry {
  private chains: Map<string, ChainDefinition> = new Map();
  private executions: Map<string, ChainExecutionResult> = new Map();
  private listeners: ChainExecutionListener[] = [];
  private tools: Map<string, BladeTool> = new Map();
  private memory?: LangChainMemoryManager;

  constructor() {
    // 初始化
  }

  /**
   * 注册工具
   */
  registerTool(name: string, tool: BladeTool): void {
    this.tools.set(name, tool);
  }

  /**
   * 设置 LangChain 记忆系统
   */
  setMemory(memory: LangChainMemoryManager): void {
    this.memory = memory;
  }

  /**
   * 链注册表实现
   */
  async register(definition: ChainDefinition): Promise<void> {
    const validation = this.validateChain(definition);
    if (!validation.valid) {
      throw new Error(`链验证失败: ${validation.errors.join(', ')}`);
    }
    this.chains.set(definition.id, definition);
  }

  async unregister(chainId: string): Promise<void> {
    this.chains.delete(chainId);
  }

  async get(chainId: string): Promise<ChainDefinition | null> {
    return this.chains.get(chainId) || null;
  }

  async list(tags?: string[]): Promise<ChainDefinition[]> {
    const allChains = Array.from(this.chains.values());
    if (!tags || tags.length === 0) {
      return allChains;
    }

    return allChains.filter(chain => tags.every(tag => chain.tags?.includes(tag)));
  }

  async search(query: string): Promise<ChainDefinition[]> {
    const queryLower = query.toLowerCase();
    return Array.from(this.chains.values()).filter(
      chain =>
        chain.name.toLowerCase().includes(queryLower) ||
        chain.description?.toLowerCase().includes(queryLower) ||
        chain.tags?.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }

  /**
   * 链执行器实现
   */
  async execute(
    chainId: string,
    input: any,
    context: ChainContext,
    config?: Partial<ChainConfig>
  ): Promise<ChainExecutionResult> {
    const chain = await this.get(chainId);
    if (!chain) {
      throw new Error(`链不存在: ${chainId}`);
    }

    const startTime = new Date();
    const executionResult: ChainExecutionResult = {
      success: false,
      chainId,
      executionId: context.executionId,
      startTime,
      endTime: startTime,
      duration: 0,
      steps: [],
    };

    this.executions.set(context.executionId, executionResult);

    try {
      // 确保会话存在
      if (this.memory && context.sessionId) {
        await this.memory.createSession(context.sessionId, context.userId);
      }

      this.emitEvent({
        type: 'chain-start',
        chainId,
        executionId: context.executionId,
        timestamp: startTime,
        data: { input, context },
      });

      // 记录链执行开始到 memory
      if (this.memory && context.sessionId) {
        await this.memory.remember(
          context.sessionId,
          MemoryType.CHAIN_STATE,
          {
            action: 'chain_start',
            chainId,
            executionId: context.executionId,
            input,
          },
          { timestamp: startTime.toISOString() }
        );
      }

      // 执行链步骤
      const stepResult = await this.executeStep(
        chain.entryPoint,
        chain,
        input,
        context,
        config || {}
      );

      executionResult.finalOutput = stepResult.output;
      executionResult.success = stepResult.success;
      executionResult.steps = this.collectStepResults(context.executionId);

      // 记录链执行完成到 memory
      if (this.memory && context.sessionId) {
        await this.memory.remember(
          context.sessionId,
          MemoryType.CHAIN_STATE,
          {
            action: 'chain_complete',
            chainId,
            executionId: context.executionId,
            success: executionResult.success,
            output: executionResult.finalOutput,
          },
          { timestamp: new Date().toISOString() }
        );
      }
    } catch (error) {
      executionResult.error = String(error);

      // 记录错误到 memory
      if (this.memory && context.sessionId) {
        await this.memory.remember(
          context.sessionId,
          MemoryType.CHAIN_STATE,
          {
            action: 'chain_error',
            chainId,
            executionId: context.executionId,
            error: String(error),
          },
          { timestamp: new Date().toISOString() }
        );
      }

      this.emitEvent({
        type: 'error',
        chainId,
        executionId: context.executionId,
        timestamp: new Date(),
        data: { error },
      });
    } finally {
      const endTime = new Date();
      executionResult.endTime = endTime;
      executionResult.duration = endTime.getTime() - startTime.getTime();

      this.emitEvent({
        type: 'chain-end',
        chainId,
        executionId: context.executionId,
        timestamp: endTime,
        data: { result: executionResult },
      });
    }

    return executionResult;
  }

  async cancel(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.success = false;
      execution.error = '执行已取消';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    }
  }

  async getStatus(executionId: string): Promise<ChainExecutionStatus> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return ChainExecutionStatus.PENDING;
    }

    if (execution.error) {
      return ChainExecutionStatus.FAILED;
    }

    if (execution.success) {
      return ChainExecutionStatus.COMPLETED;
    }

    return ChainExecutionStatus.RUNNING;
  }

  async getResult(executionId: string): Promise<ChainExecutionResult | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    stepId: string,
    chain: ChainDefinition,
    input: any,
    context: ChainContext,
    config: Partial<ChainConfig>
  ): Promise<StepExecutionResult> {
    const step = chain.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`);
    }

    const startTime = new Date();
    const result: StepExecutionResult = {
      stepId: step.id,
      stepName: step.name,
      success: false,
      startTime,
      endTime: startTime,
      duration: 0,
      input,
    };

    try {
      this.emitEvent({
        type: 'step-start',
        chainId: chain.id,
        executionId: context.executionId,
        stepId: step.id,
        timestamp: startTime,
        data: { step, input },
      });

      // 根据步骤类型执行
      switch (step.type) {
        case 'tool':
          result.output = await this.executeTool(step.config as ToolStepConfig, input, context);
          break;
        case 'prompt':
          result.output = await this.executePrompt(step.config as PromptStepConfig, input, context);
          break;
        case 'condition':
          result.output = await this.executeCondition(
            step.config as ConditionStepConfig,
            input,
            context,
            chain,
            config
          );
          break;
        case 'transform':
          result.output = await this.executeTransform(
            step.config as TransformStepConfig,
            input,
            context
          );
          break;
        case 'parallel':
          result.output = await this.executeParallel(
            step.config as ParallelStepConfig,
            input,
            context,
            chain,
            config
          );
          break;
        case 'sequence':
          result.output = await this.executeSequence(
            step.config as SequenceStepConfig,
            input,
            context,
            chain,
            config
          );
          break;
        default:
          throw new Error(`不支持的步骤类型: ${step.type}`);
      }

      result.success = true;
    } catch (error) {
      result.error = String(error);
      this.emitEvent({
        type: 'error',
        chainId: chain.id,
        executionId: context.executionId,
        stepId: step.id,
        timestamp: new Date(),
        data: { error },
      });
    } finally {
      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();

      this.emitEvent({
        type: 'step-end',
        chainId: chain.id,
        executionId: context.executionId,
        stepId: step.id,
        timestamp: endTime,
        data: { result },
      });
    }

    return result;
  }

  /**
   * 执行工具步骤 - 使用 LangChain memory
   */
  private async executeTool(
    config: ToolStepConfig,
    input: any,
    context: ChainContext
  ): Promise<any> {
    const tool = this.tools.get(config.toolName);
    if (!tool) {
      throw new Error(`工具不存在: ${config.toolName}`);
    }

    // 合并参数
    const parameters = { ...config.parameters, ...input };

    // 执行工具
    const result = await tool.execute(parameters);

    // 记忆存储到 LangChain memory
    if (this.memory && context.sessionId) {
      await this.memory.remember(
        context.sessionId,
        MemoryType.TOOL_RESULT,
        {
          toolName: config.toolName,
          parameters,
          result,
          executionId: context.executionId,
        },
        {
          stepId: `tool_${config.toolName}`,
          timestamp: new Date().toISOString(),
        }
      );
    }

    return result;
  }

  /**
   * 执行提示步骤 - 集成 LangChain memory
   */
  private async executePrompt(
    config: PromptStepConfig,
    input: any,
    context: ChainContext
  ): Promise<any> {
    // 从 memory 获取历史上下文
    let memoryContext = '';
    if (this.memory && context.sessionId) {
      const memoryVars = await this.memory.getMemoryVariables(context.sessionId, input);
      memoryContext = memoryVars.chat_history || memoryVars.history || '';
    }

    // 模板替换
    let template = config.template;
    const variables = {
      ...config.variables,
      ...input,
      memory_context: memoryContext, // 注入 memory 上下文
    };

    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // 记录对话到 memory
    if (this.memory && context.sessionId) {
      await this.memory.remember(context.sessionId, MemoryType.CONVERSATION, {
        role: 'user',
        message: template,
      });

      // 模拟 AI 响应（实际应该调用 LLM）
      const response = '模拟 LLM 响应';
      await this.memory.remember(context.sessionId, MemoryType.CONVERSATION, {
        role: 'assistant',
        message: response,
      });

      return { prompt: template, response, memory_context: memoryContext };
    }

    return { prompt: template, response: '模拟 LLM 响应' };
  }

  /**
   * 执行条件步骤
   */
  private async executeCondition(
    config: ConditionStepConfig,
    input: any,
    context: ChainContext,
    chain: ChainDefinition,
    chainConfig: Partial<ChainConfig>
  ): Promise<any> {
    // 简化条件评估
    const variables = { ...config.variables, ...input };
    let condition = config.condition;

    for (const [key, value] of Object.entries(variables)) {
      condition = condition.replace(new RegExp(`\\b${key}\\b`, 'g'), JSON.stringify(value));
    }

    // 评估条件
    let conditionResult: boolean;
    try {
      conditionResult = eval(condition);
    } catch (error) {
      throw new Error(`条件评估失败: ${condition}`);
    }

    const nextStepId = conditionResult ? config.trueStep : config.falseStep;
    if (!nextStepId) {
      return { condition: conditionResult, result: null };
    }

    const nextResult = await this.executeStep(nextStepId, chain, input, context, chainConfig);
    return { condition: conditionResult, result: nextResult.output };
  }

  /**
   * 执行转换步骤
   */
  private async executeTransform(
    config: TransformStepConfig,
    input: any,
    _context: ChainContext
  ): Promise<any> {
    // 简化转换实现
    const transformer = new Function('input', `return (${config.transformer})(input)`);
    return transformer(input);
  }

  /**
   * 执行并行步骤
   */
  private async executeParallel(
    config: ParallelStepConfig,
    input: any,
    context: ChainContext,
    chain: ChainDefinition,
    chainConfig: Partial<ChainConfig>
  ): Promise<any> {
    const promises = config.steps.map(stepId =>
      this.executeStep(stepId, chain, input, context, chainConfig)
    );

    const results = await Promise.allSettled(promises);
    const outputs = results.map(result =>
      result.status === 'fulfilled' ? result.value.output : null
    );

    // 合并策略
    switch (config.mergeStrategy) {
      case 'array':
        return outputs;
      case 'first':
        return outputs[0];
      case 'merge':
        return Object.assign({}, ...outputs.filter(Boolean));
      default:
        return outputs;
    }
  }

  /**
   * 执行序列步骤
   */
  private async executeSequence(
    config: SequenceStepConfig,
    input: any,
    context: ChainContext,
    chain: ChainDefinition,
    chainConfig: Partial<ChainConfig>
  ): Promise<any> {
    let currentInput = input;
    let lastOutput = null;

    for (const stepId of config.steps) {
      const result = await this.executeStep(stepId, chain, currentInput, context, chainConfig);
      lastOutput = result.output;

      if (config.passthrough) {
        currentInput = { ...currentInput, ...lastOutput };
      } else {
        currentInput = lastOutput;
      }
    }

    return lastOutput;
  }

  /**
   * 收集步骤结果
   */
  private collectStepResults(executionId: string): StepExecutionResult[] {
    // 简化实现，实际应该跟踪所有步骤
    return [];
  }

  /**
   * 验证链定义
   */
  private validateChain(definition: ChainDefinition): ChainValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查入口点
    if (!definition.steps.find(s => s.id === definition.entryPoint)) {
      errors.push(`入口点步骤不存在: ${definition.entryPoint}`);
    }

    // 检查步骤依赖
    for (const step of definition.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!definition.steps.find(s => s.id === dep)) {
            errors.push(`步骤 ${step.id} 依赖不存在: ${dep}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: [],
    };
  }

  /**
   * 事件系统
   */
  addEventListener(listener: ChainExecutionListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: ChainExecutionListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private emitEvent(event: ChainExecutionEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('Chain event listener error:', error);
          });
        }
      } catch (error) {
        console.error('Chain event listener error:', error);
      }
    }
  }

  /**
   * 创建链构建器
   */
  static createBuilder(): ChainBuilder {
    return new BladeChainBuilder();
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.chains.clear();
    this.executions.clear();
    this.listeners.length = 0;
    this.tools.clear();
  }
}

/**
 * 链构建器实现
 */
class BladeChainBuilder implements ChainBuilder {
  private definition: Partial<ChainDefinition> = {
    steps: [],
    version: '1.0.0',
  };

  step(config: ChainStep): ChainBuilder {
    this.definition.steps!.push(config);
    return this;
  }

  tool(name: string, config: ToolStepConfig): ChainBuilder {
    return this.step({
      id: `tool_${name}_${Date.now()}`,
      name: `执行工具: ${name}`,
      type: 'tool',
      config,
    });
  }

  prompt(template: string, config?: Partial<PromptStepConfig>): ChainBuilder {
    return this.step({
      id: `prompt_${Date.now()}`,
      name: '提示处理',
      type: 'prompt',
      config: {
        template,
        ...config,
      } as PromptStepConfig,
    });
  }

  condition(condition: string, trueStep: string, falseStep?: string): ChainBuilder {
    return this.step({
      id: `condition_${Date.now()}`,
      name: '条件判断',
      type: 'condition',
      config: {
        condition,
        trueStep,
        falseStep,
      } as ConditionStepConfig,
    });
  }

  transform(transformer: string): ChainBuilder {
    return this.step({
      id: `transform_${Date.now()}`,
      name: '数据转换',
      type: 'transform',
      config: {
        transformer,
      } as TransformStepConfig,
    });
  }

  parallel(steps: string[], config?: Partial<ParallelStepConfig>): ChainBuilder {
    return this.step({
      id: `parallel_${Date.now()}`,
      name: '并行执行',
      type: 'parallel',
      config: {
        steps,
        mergeStrategy: 'merge',
        failureStrategy: 'fail',
        ...config,
      } as ParallelStepConfig,
    });
  }

  sequence(steps: string[], config?: Partial<SequenceStepConfig>): ChainBuilder {
    return this.step({
      id: `sequence_${Date.now()}`,
      name: '序列执行',
      type: 'sequence',
      config: {
        steps,
        ...config,
      } as SequenceStepConfig,
    });
  }

  memory(config: any): ChainBuilder {
    this.definition.memory = {
      enabled: true,
      type: 'langchain',
      config,
    };
    return this;
  }

  build(): ChainDefinition {
    if (!this.definition.id) {
      this.definition.id = `chain_${Date.now()}`;
    }
    if (!this.definition.name) {
      this.definition.name = `链 ${this.definition.id}`;
    }
    if (!this.definition.entryPoint && this.definition.steps!.length > 0) {
      this.definition.entryPoint = this.definition.steps![0].id;
    }

    return this.definition as ChainDefinition;
  }
}
