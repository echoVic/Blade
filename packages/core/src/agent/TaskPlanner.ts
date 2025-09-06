/**
 * 任务规划器 - 智能分析任务并制定执行计划
 */

import type { BladeConfig } from '../config/types/index.js';
import type { AgentTask, ExecutionStep } from './MainAgent.js';

export interface PlanningContext {
  availableSubAgents: string[];
  availableTools: string[];
  systemCapabilities: string[];
  resourceLimits: {
    maxExecutionTime: number;
    maxSubAgentTasks: number;
    maxToolCalls: number;
  };
}

export interface TaskComplexity {
  level: 'simple' | 'medium' | 'complex' | 'very_complex';
  factors: string[];
  estimatedSteps: number;
  estimatedTime: number;
  requiresSubAgents: boolean;
  requiresTools: boolean;
}

/**
 * 任务规划器
 */
export class TaskPlanner {
  private config: BladeConfig;
  private isInitialized = false;
  private planningHistory: Array<{
    taskId: string;
    complexity: TaskComplexity;
    plan: ExecutionStep[];
    actualSteps: number;
    actualTime: number;
    success: boolean;
  }> = [];

  constructor(config: BladeConfig) {
    this.config = config;
  }

  /**
   * 初始化规划器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('初始化任务规划器...');
    this.isInitialized = true;
    this.log('任务规划器初始化完成');
  }

  /**
   * 销毁规划器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.log('销毁任务规划器...');
    this.planningHistory = [];
    this.isInitialized = false;
    this.log('任务规划器已销毁');
  }

  /**
   * 规划任务执行步骤
   */
  public async planTask(task: AgentTask, context?: PlanningContext): Promise<ExecutionStep[]> {
    if (!this.isInitialized) {
      throw new Error('任务规划器未初始化');
    }

    try {
      this.log(`开始规划任务: ${task.id}`);

      // 1. 分析任务复杂度
      const complexity = await this.analyzeComplexity(task);
      this.log(`任务复杂度: ${complexity.level}`, complexity);

      // 2. 根据复杂度选择规划策略
      let executionPlan: ExecutionStep[];
      switch (complexity.level) {
        case 'simple':
          executionPlan = await this.planSimpleTask(task, complexity);
          break;
        case 'medium':
          executionPlan = await this.planMediumTask(task, complexity);
          break;
        case 'complex':
          executionPlan = await this.planComplexTask(task, complexity);
          break;
        case 'very_complex':
          executionPlan = await this.planVeryComplexTask(task, complexity);
          break;
        default:
          throw new Error(`未知的复杂度级别: ${complexity.level}`);
      }

      // 3. 优化执行计划
      executionPlan = await this.optimizePlan(executionPlan, context);

      // 4. 记录规划历史
      this.recordPlanning(task, complexity, executionPlan);

      this.log(`任务规划完成，共${executionPlan.length}个步骤`);
      return executionPlan;
    } catch (error) {
      this.error(`任务规划失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 分析任务复杂度
   */
  private async analyzeComplexity(task: AgentTask): Promise<TaskComplexity> {
    const prompt = task.prompt.toLowerCase();
    const factors: string[] = [];
    let estimatedSteps = 1;
    let level: TaskComplexity['level'] = 'simple';

    // 分析复杂度因子
    if (prompt.includes('分析') || prompt.includes('analysis')) {
      factors.push('需要分析');
      estimatedSteps += 1;
    }

    if (prompt.includes('生成') || prompt.includes('创建') || prompt.includes('实现')) {
      factors.push('需要生成内容');
      estimatedSteps += 1;
    }

    if (prompt.includes('多个') || prompt.includes('批量') || prompt.includes('所有')) {
      factors.push('批量操作');
      estimatedSteps += 2;
    }

    if (prompt.includes('文件') || prompt.includes('代码') || prompt.includes('项目')) {
      factors.push('涉及文件操作');
      estimatedSteps += 1;
    }

    if (prompt.includes('测试') || prompt.includes('验证') || prompt.includes('检查')) {
      factors.push('需要验证');
      estimatedSteps += 1;
    }

    if (prompt.includes('优化') || prompt.includes('重构') || prompt.includes('改进')) {
      factors.push('需要优化');
      estimatedSteps += 2;
    }

    // 根据步骤数量确定复杂度级别
    if (estimatedSteps <= 2) {
      level = 'simple';
    } else if (estimatedSteps <= 4) {
      level = 'medium';
    } else if (estimatedSteps <= 7) {
      level = 'complex';
    } else {
      level = 'very_complex';
    }

    const estimatedTime = estimatedSteps * 2000; // 每步骤预估2秒
    const requiresSubAgents = level !== 'simple';
    const requiresTools = factors.some(f => f.includes('文件') || f.includes('验证'));

    return {
      level,
      factors,
      estimatedSteps,
      estimatedTime,
      requiresSubAgents,
      requiresTools,
    };
  }

  /**
   * 规划简单任务
   */
  private async planSimpleTask(
    task: AgentTask,
    complexity: TaskComplexity
  ): Promise<ExecutionStep[]> {
    return [
      {
        id: this.generateStepId(),
        type: 'llm',
        description: '直接LLM处理',
        status: 'pending',
      },
    ];
  }

  /**
   * 规划中等任务
   */
  private async planMediumTask(
    task: AgentTask,
    complexity: TaskComplexity
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // 添加分析步骤
    if (complexity.factors.includes('需要分析')) {
      steps.push({
        id: this.generateStepId(),
        type: 'subagent',
        description: '分析任务需求',
        status: 'pending',
        metadata: { agentName: 'analysis-agent' },
      });
    }

    // 添加主要执行步骤
    steps.push({
      id: this.generateStepId(),
      type: 'llm',
      description: '执行主要任务',
      status: 'pending',
    });

    return steps;
  }

  /**
   * 规划复杂任务
   */
  private async planComplexTask(
    task: AgentTask,
    complexity: TaskComplexity
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // 1. 任务分解
    steps.push({
      id: this.generateStepId(),
      type: 'subagent',
      description: '分解任务',
      status: 'pending',
      metadata: { agentName: 'planning-agent' },
    });

    // 2. 并行执行子任务
    if (complexity.factors.includes('批量操作')) {
      steps.push({
        id: this.generateStepId(),
        type: 'subagent',
        description: '并行处理子任务',
        status: 'pending',
        metadata: { agentName: 'batch-agent' },
      });
    }

    // 3. 工具调用
    if (complexity.requiresTools) {
      steps.push({
        id: this.generateStepId(),
        type: 'tool',
        description: '执行工具调用',
        status: 'pending',
      });
    }

    // 4. 结果整合
    steps.push({
      id: this.generateStepId(),
      type: 'llm',
      description: '整合执行结果',
      status: 'pending',
    });

    return steps;
  }

  /**
   * 规划非常复杂任务
   */
  private async planVeryComplexTask(
    task: AgentTask,
    complexity: TaskComplexity
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // 1. 深度任务分析
    steps.push({
      id: this.generateStepId(),
      type: 'subagent',
      description: '深度分析任务需求',
      status: 'pending',
      metadata: { agentName: 'analysis-agent' },
    });

    // 2. 制定详细计划
    steps.push({
      id: this.generateStepId(),
      type: 'subagent',
      description: '制定详细执行计划',
      status: 'pending',
      metadata: { agentName: 'planning-agent' },
    });

    // 3. 分阶段执行
    for (let phase = 1; phase <= Math.min(complexity.estimatedSteps - 2, 5); phase++) {
      steps.push({
        id: this.generateStepId(),
        type: 'subagent',
        description: `执行第${phase}阶段任务`,
        status: 'pending',
        metadata: { agentName: 'execution-agent', phase },
      });
    }

    // 4. 质量检查
    steps.push({
      id: this.generateStepId(),
      type: 'subagent',
      description: '质量检查和验证',
      status: 'pending',
      metadata: { agentName: 'quality-agent' },
    });

    // 5. 最终整合
    steps.push({
      id: this.generateStepId(),
      type: 'llm',
      description: '最终结果整合',
      status: 'pending',
    });

    return steps;
  }

  /**
   * 优化执行计划
   */
  private async optimizePlan(
    plan: ExecutionStep[],
    context?: PlanningContext
  ): Promise<ExecutionStep[]> {
    if (!context) {
      return plan;
    }

    // 检查资源限制
    const subAgentSteps = plan.filter(step => step.type === 'subagent').length;
    const toolSteps = plan.filter(step => step.type === 'tool').length;

    if (subAgentSteps > context.resourceLimits.maxSubAgentTasks) {
      this.log(
        `子Agent步骤数量超限，进行优化: ${subAgentSteps} -> ${context.resourceLimits.maxSubAgentTasks}`
      );
      // 合并部分子Agent步骤
      return this.mergeSubAgentSteps(plan, context.resourceLimits.maxSubAgentTasks);
    }

    if (toolSteps > context.resourceLimits.maxToolCalls) {
      this.log(
        `工具调用数量超限，进行优化: ${toolSteps} -> ${context.resourceLimits.maxToolCalls}`
      );
      // 合并部分工具步骤
      return this.mergeToolSteps(plan, context.resourceLimits.maxToolCalls);
    }

    return plan;
  }

  /**
   * 合并子Agent步骤
   */
  private mergeSubAgentSteps(plan: ExecutionStep[], maxSteps: number): ExecutionStep[] {
    // 简单实现：保留前N个子Agent步骤
    let subAgentCount = 0;
    return plan.filter(step => {
      if (step.type === 'subagent') {
        subAgentCount++;
        return subAgentCount <= maxSteps;
      }
      return true;
    });
  }

  /**
   * 合并工具步骤
   */
  private mergeToolSteps(plan: ExecutionStep[], maxSteps: number): ExecutionStep[] {
    // 简单实现：保留前N个工具步骤
    let toolCount = 0;
    return plan.filter(step => {
      if (step.type === 'tool') {
        toolCount++;
        return toolCount <= maxSteps;
      }
      return true;
    });
  }

  /**
   * 记录规划历史
   */
  private recordPlanning(task: AgentTask, complexity: TaskComplexity, plan: ExecutionStep[]): void {
    this.planningHistory.push({
      taskId: task.id,
      complexity,
      plan: [...plan],
      actualSteps: 0,
      actualTime: 0,
      success: false,
    });

    // 限制历史记录大小
    if (this.planningHistory.length > 1000) {
      this.planningHistory = this.planningHistory.slice(-1000);
    }
  }

  /**
   * 更新规划结果
   */
  public updatePlanningResult(
    taskId: string,
    actualSteps: number,
    actualTime: number,
    success: boolean
  ): void {
    const record = this.planningHistory.find(r => r.taskId === taskId);
    if (record) {
      record.actualSteps = actualSteps;
      record.actualTime = actualTime;
      record.success = success;
    }
  }

  /**
   * 获取规划统计信息
   */
  public getPlanningStats() {
    const totalPlans = this.planningHistory.length;
    const successfulPlans = this.planningHistory.filter(p => p.success).length;
    const averageSteps =
      totalPlans > 0
        ? this.planningHistory.reduce((sum, p) => sum + p.actualSteps, 0) / totalPlans
        : 0;

    return {
      totalPlans,
      successfulPlans,
      successRate: totalPlans > 0 ? successfulPlans / totalPlans : 0,
      averageSteps,
      complexityDistribution: this.getComplexityDistribution(),
    };
  }

  /**
   * 获取复杂度分布
   */
  private getComplexityDistribution() {
    const distribution = {
      simple: 0,
      medium: 0,
      complex: 0,
      very_complex: 0,
    };

    for (const record of this.planningHistory) {
      distribution[record.complexity.level]++;
    }

    return distribution;
  }

  /**
   * 生成步骤ID
   */
  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: any): void {
    console.log(`[TaskPlanner] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: any): void {
    console.error(`[TaskPlanner] ${message}`, error || '');
  }
}
