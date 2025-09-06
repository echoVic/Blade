/**
 * Agent工具 - 实现递归代理调用
 */

import type { ToolDefinition } from '../../tools/types.js';
import type { MainAgent } from '../MainAgent.js';
import type { TaskRequest } from '../SubAgentRegistry.js';

export interface AgentToolParams {
  agentName: string;
  taskType: 'chat' | 'analysis' | 'code' | 'tool';
  prompt: string;
  context?: any;
  options?: {
    temperature?: number;
    maxTokens?: number;
    priority?: number;
  };
}

export interface AgentToolResult {
  success: boolean;
  content: any;
  agentName: string;
  executionTime: number;
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Agent工具 - 实现Sub-Agent递归调用
 */
export class AgentTool implements ToolDefinition {
  public readonly name = 'agent';
  public readonly description = '调用子Agent处理特定类型的任务，支持递归代理模式';
  public readonly version = '1.0.0';
  public readonly category = 'agent';
  public readonly tags = ['agent', 'subagent', 'delegation', 'recursive'];

  public readonly parameters = {
    agentName: {
      type: 'string' as const,
      description: '要调用的子Agent名称 (code-agent, analysis-agent, documentation-agent等)',
      enum: [
        'code-agent',
        'analysis-agent',
        'documentation-agent',
        'test-agent',
        'planning-agent',
        'quality-agent',
        'git-agent',
        'file-agent',
      ],
    },
    taskType: {
      type: 'string' as const,
      description: '任务类型',
      enum: ['chat', 'analysis', 'code', 'tool'],
    },
    prompt: {
      type: 'string' as const,
      description: '要传递给子Agent的任务描述',
    },
    context: {
      type: 'object' as const,
      description: '任务上下文信息（可选）',
      optional: true,
    },
    options: {
      type: 'object' as const,
      description: '执行选项（可选）',
      optional: true,
      properties: {
        temperature: {
          type: 'number' as const,
          description: '温度参数 (0.0-1.0)',
        },
        maxTokens: {
          type: 'number' as const,
          description: '最大token数',
        },
        priority: {
          type: 'number' as const,
          description: '任务优先级 (1-10)',
        },
      },
    },
  };

  public readonly required = ['agentName', 'taskType', 'prompt'];

  private mainAgent: MainAgent;

  constructor(mainAgent: MainAgent) {
    this.mainAgent = mainAgent;
  }

  /**
   * 执行Agent工具调用
   */
  public async execute(params: AgentToolParams): Promise<AgentToolResult> {
    const startTime = Date.now();

    try {
      this.log(`执行Agent工具调用: ${params.agentName}`);

      // 验证参数
      this.validateParams(params);

      // 获取子Agent注册器
      const subAgentRegistry = this.mainAgent.getSubAgentRegistry();

      // 查找目标子Agent
      const targetAgent = subAgentRegistry.getAgent(params.agentName);
      if (!targetAgent) {
        // 如果指定的Agent不存在，尝试找到最适合的Agent
        const taskRequest: TaskRequest = {
          id: this.generateTaskId(),
          type: params.taskType,
          prompt: params.prompt,
          context: params.context,
          metadata: params.options,
        };

        const bestAgent = subAgentRegistry.findBestAgent(taskRequest);
        if (!bestAgent) {
          throw new Error(`未找到合适的Agent处理任务，请求的Agent: ${params.agentName}`);
        }

        this.log(`Agent "${params.agentName}" 不存在，使用最佳匹配Agent: ${bestAgent.getName()}`);
        return await this.executeWithAgent(bestAgent, taskRequest, startTime);
      }

      // 使用指定的Agent执行任务
      const taskRequest: TaskRequest = {
        id: this.generateTaskId(),
        type: params.taskType,
        prompt: params.prompt,
        context: params.context,
        metadata: params.options,
      };

      return await this.executeWithAgent(targetAgent, taskRequest, startTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.error(`Agent工具执行失败: ${params.agentName}`, error);

      return {
        success: false,
        content: null,
        agentName: params.agentName,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 使用指定Agent执行任务
   */
  private async executeWithAgent(
    agent: any,
    taskRequest: TaskRequest,
    startTime: number
  ): Promise<AgentToolResult> {
    try {
      // 检查Agent是否能处理任务
      if (!agent.canHandle(taskRequest)) {
        this.log(`Agent "${agent.getName()}" 无法处理此任务，尝试通用处理`);
      }

      // 执行任务
      const result = await agent.executeTask(taskRequest);
      const executionTime = Date.now() - startTime;

      this.log(`Agent任务执行成功: ${agent.getName()}，耗时: ${executionTime}ms`);

      return {
        success: true,
        content: result.content,
        agentName: agent.getName(),
        executionTime,
        metadata: {
          taskId: result.taskId,
          originalAgentName: agent.getName(),
          ...result.metadata,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.error(`Agent执行失败: ${agent.getName()}`, error);

      return {
        success: false,
        content: null,
        agentName: agent.getName(),
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParams(params: AgentToolParams): void {
    if (!params.agentName || typeof params.agentName !== 'string') {
      throw new Error('agentName参数必须是有效的字符串');
    }

    if (!params.taskType || !['chat', 'analysis', 'code', 'tool'].includes(params.taskType)) {
      throw new Error('taskType参数必须是有效的任务类型');
    }

    if (!params.prompt || typeof params.prompt !== 'string') {
      throw new Error('prompt参数必须是非空字符串');
    }

    if (params.options) {
      if (params.options.temperature !== undefined) {
        if (
          typeof params.options.temperature !== 'number' ||
          params.options.temperature < 0 ||
          params.options.temperature > 1
        ) {
          throw new Error('temperature参数必须是0-1之间的数字');
        }
      }

      if (params.options.maxTokens !== undefined) {
        if (typeof params.options.maxTokens !== 'number' || params.options.maxTokens < 1) {
          throw new Error('maxTokens参数必须是大于0的数字');
        }
      }

      if (params.options.priority !== undefined) {
        if (
          typeof params.options.priority !== 'number' ||
          params.options.priority < 1 ||
          params.options.priority > 10
        ) {
          throw new Error('priority参数必须是1-10之间的数字');
        }
      }
    }
  }

  /**
   * 获取可用的子Agent列表
   */
  public getAvailableAgents(): string[] {
    const subAgentRegistry = this.mainAgent.getSubAgentRegistry();
    return subAgentRegistry.getAllAgents().map(agent => agent.name);
  }

  /**
   * 获取Agent能力描述
   */
  public getAgentCapabilities(agentName: string): string[] | undefined {
    const subAgentRegistry = this.mainAgent.getSubAgentRegistry();
    const agent = subAgentRegistry.getAgent(agentName);
    return agent?.getCapabilities();
  }

  /**
   * 推荐最适合的Agent
   */
  public recommendAgent(
    taskDescription: string
  ): { agentName: string; confidence: number; reason: string } | null {
    const taskRequest: TaskRequest = {
      id: this.generateTaskId(),
      type: 'chat',
      prompt: taskDescription,
    };

    const subAgentRegistry = this.mainAgent.getSubAgentRegistry();
    const bestAgent = subAgentRegistry.findBestAgent(taskRequest);

    if (!bestAgent) {
      return null;
    }

    return {
      agentName: bestAgent.getName(),
      confidence: 0.8, // 简化实现
      reason: `基于任务特征分析，${bestAgent.getName()}最适合处理此类任务`,
    };
  }

  /**
   * 获取工具使用统计
   */
  public getUsageStats(): {
    totalCalls: number;
    successRate: number;
    averageExecutionTime: number;
    agentUsageDistribution: Record<string, number>;
  } {
    // 这里应该记录使用统计，暂时返回模拟数据
    return {
      totalCalls: 0,
      successRate: 0.95,
      averageExecutionTime: 1500,
      agentUsageDistribution: {},
    };
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `agent_task_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: any): void {
    console.log(`[AgentTool] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: any): void {
    console.error(`[AgentTool] ${message}`, error || '');
  }
}
