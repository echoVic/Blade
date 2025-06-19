/**
 * 通义千问 ReAct Agent
 *
 * 专门为通义千问模型优化的 ReAct Agent 实现
 * 使用自定义的中文输出解析器
 */

import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { BladeToolkit } from '../tools/BladeToolkit.js';
import { QwenReActOutputParser } from './parsers/QwenReActOutputParser.js';

/**
 * 通义千问 ReAct Agent 配置
 */
export interface QwenReActAgentConfig {
  /** 语言模型 */
  llm: BaseChatModel;
  /** 工具包或工具数组 */
  tools: Tool[] | BladeToolkit;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * 通义千问 ReAct Agent 执行结果
 */
export interface QwenAgentResult {
  /** 输出内容 */
  output: string;
  /** 中间步骤 */
  intermediateSteps: Array<{
    action: AgentAction;
    observation: string;
  }>;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 通义千问 ReAct Agent
 *
 * 特点：
 * - 专门适配通义千问的中文输出格式
 * - 支持中英文混合的关键字识别
 * - 优化的提示词模板
 * - 更好的错误处理和重试机制
 */
export class QwenReActAgent {
  private config: QwenReActAgentConfig;
  private parser: QwenReActOutputParser;
  private currentIteration: number = 0;
  private tools: Tool[];

  constructor(config: QwenReActAgentConfig) {
    this.config = {
      maxIterations: 10,
      systemPrompt: this.getDefaultSystemPrompt(),
      debug: false,
      ...config,
    };
    this.parser = new QwenReActOutputParser();

    // 处理工具配置
    if (Array.isArray(config.tools)) {
      this.tools = config.tools;
    } else {
      // BladeToolkit 情况
      this.tools = config.tools.getAllTools();
    }
  }

  /**
   * 创建通义千问 ReAct Agent
   */
  static create(config: QwenReActAgentConfig): QwenReActAgent {
    return new QwenReActAgent(config);
  }

  /**
   * 执行单次推理
   */
  async invoke(input: string): Promise<QwenAgentResult> {
    this.currentIteration = 0;
    const intermediateSteps: Array<{ action: AgentAction; observation: string }> = [];

    try {
      // 初始化消息历史
      const messages: BaseMessage[] = [
        new SystemMessage(this.buildSystemPrompt()),
        new HumanMessage(input),
      ];

      while (this.currentIteration < this.config.maxIterations!) {
        this.currentIteration++;

        if (this.config.debug) {
          console.log(`🔄 通义千问 ReAct Agent - 第 ${this.currentIteration} 轮推理`);
        }

        // 调用模型
        const response = await this.config.llm.invoke(messages);
        const rawOutput = response.content as string;

        if (this.config.debug) {
          console.log(`📝 模型输出:\n${rawOutput}`);
        }

        // 解析输出
        try {
          const parsed = await this.parser.parse(rawOutput);

          if ('returnValues' in parsed) {
            // 最终答案
            const agentFinish = parsed as AgentFinish;
            return {
              output: agentFinish.returnValues.output,
              intermediateSteps,
              success: true,
            };
          } else {
            // 执行动作
            const agentAction = parsed as AgentAction;
            const observation = await this.executeAction(agentAction);

            // 记录步骤
            intermediateSteps.push({ action: agentAction, observation });

            // 更新消息历史
            messages.push(new AIMessage(rawOutput));
            messages.push(new HumanMessage(`观察结果: ${observation}`));

            if (this.config.debug) {
              console.log(`🛠️ 执行工具: ${agentAction.tool}`);
              console.log(`📥 工具输入: ${agentAction.toolInput}`);
              console.log(`📤 观察结果: ${observation}`);
            }
          }
        } catch (parseError) {
          if (this.config.debug) {
            console.warn(`⚠️ 解析错误: ${parseError}`);
          }

          // 解析失败，给模型反馈并重试
          const errorFeedback = `解析失败，请严格按照格式要求回答。错误: ${parseError}`;
          messages.push(new AIMessage(rawOutput));
          messages.push(new HumanMessage(errorFeedback));
        }
      }

      return {
        output: '已达到最大迭代次数，未能得到最终答案',
        intermediateSteps,
        success: false,
        error: 'MAX_ITERATIONS_REACHED',
      };
    } catch (error) {
      return {
        output: '执行过程中发生错误',
        intermediateSteps,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 流式执行
   */
  async *stream(input: string): AsyncGenerator<{
    type: 'thinking' | 'action' | 'observation' | 'final';
    content: string;
    data?: any;
  }> {
    yield { type: 'thinking', content: '🧠 通义千问正在思考...' };

    this.currentIteration = 0;
    const intermediateSteps: Array<{ action: AgentAction; observation: string }> = [];

    const messages: BaseMessage[] = [
      new SystemMessage(this.buildSystemPrompt()),
      new HumanMessage(input),
    ];

    try {
      while (this.currentIteration < this.config.maxIterations!) {
        this.currentIteration++;

        yield {
          type: 'thinking',
          content: `🔄 第 ${this.currentIteration} 轮推理中...`,
        };

        // 调用模型
        const response = await this.config.llm.invoke(messages);
        const rawOutput = response.content as string;

        // 解析输出
        try {
          const parsed = await this.parser.parse(rawOutput);

          if ('returnValues' in parsed) {
            // 最终答案
            const agentFinish = parsed as AgentFinish;
            yield {
              type: 'final',
              content: agentFinish.returnValues.output,
              data: { intermediateSteps, success: true },
            };
            return;
          } else {
            // 执行动作
            const agentAction = parsed as AgentAction;

            yield {
              type: 'action',
              content: `🛠️ 使用工具: ${agentAction.tool}`,
              data: { action: agentAction },
            };

            const observation = await this.executeAction(agentAction);
            intermediateSteps.push({ action: agentAction, observation });

            yield {
              type: 'observation',
              content: `📤 观察结果: ${observation}`,
              data: { observation },
            };

            // 更新消息历史
            messages.push(new AIMessage(rawOutput));
            messages.push(new HumanMessage(`观察结果: ${observation}`));
          }
        } catch (parseError) {
          // 解析失败，给模型反馈并重试
          const errorFeedback = `解析失败，请严格按照格式要求回答。错误: ${parseError}`;
          messages.push(new AIMessage(rawOutput));
          messages.push(new HumanMessage(errorFeedback));

          yield {
            type: 'thinking',
            content: `⚠️ 解析失败，重新思考中...`,
          };
        }
      }

      yield {
        type: 'final',
        content: '已达到最大迭代次数，未能得到最终答案',
        data: { intermediateSteps, success: false, error: 'MAX_ITERATIONS_REACHED' },
      };
    } catch (error) {
      yield {
        type: 'final',
        content: '执行过程中发生错误',
        data: {
          intermediateSteps,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * 执行工具动作
   */
  private async executeAction(action: AgentAction): Promise<string> {
    try {
      const tool = this.tools.find(t => t.name === action.tool);
      if (!tool) {
        return `错误: 未找到工具 "${action.tool}"。可用工具: ${this.tools.map(t => t.name).join(', ')}`;
      }

      const result = await tool.invoke(action.toolInput);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      return `工具执行错误: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    const toolDescriptions = this.tools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    return `${this.config.systemPrompt}

你可以使用以下工具：
${toolDescriptions}

${this.parser.getFormatInstructions()}

重要提醒：
1. 必须严格按照格式要求回答
2. 每次只能使用一个工具
3. 如果不需要使用工具，直接给出最终答案
4. 中英文关键字都可以使用，但格式必须正确`;
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return `你是一个智能助手，可以使用各种工具来帮助用户解决问题。

你的工作流程：
1. 仔细分析用户的问题
2. 思考是否需要使用工具获取信息
3. 如果需要，选择合适的工具并提供正确的输入
4. 根据工具的结果继续推理或给出最终答案
5. 确保你的回答准确、有用且易于理解`;
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): string[] {
    return this.tools.map(tool => tool.name);
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<QwenReActAgentConfig>): void {
    this.config = { ...this.config, ...updates };

    // 如果更新了工具，重新设置
    if (updates.tools) {
      if (Array.isArray(updates.tools)) {
        this.tools = updates.tools;
      } else {
        this.tools = updates.tools.getAllTools();
      }
    }
  }
}
