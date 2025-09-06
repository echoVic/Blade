/**
 * 实时Steering控制器
 * 根据任务特征和实时反馈动态调整Agent行为
 */

import type { BladeConfig } from '../config/types/index.js';
import type { AgentTask } from './MainAgent.js';

export interface SteeringResult {
  shouldDelegate: boolean;
  recommendedAgent?: string;
  adjustments: SteeringAdjustment[];
  confidence: number;
  reasoning: string;
}

export interface SteeringAdjustment {
  type: 'temperature' | 'model' | 'context_window' | 'tool_selection' | 'execution_mode';
  value: any;
  reason: string;
}

export interface SteeringContext {
  taskHistory: Array<{
    task: AgentTask;
    success: boolean;
    executionTime: number;
    adjustments: SteeringAdjustment[];
  }>;
  systemLoad: {
    cpuUsage: number;
    memoryUsage: number;
    activeAgents: number;
  };
  modelPerformance: {
    averageResponseTime: number;
    errorRate: number;
    qualityScore: number;
  };
}

/**
 * 实时Steering控制器
 */
export class SteeringController {
  private config: BladeConfig;
  private isInitialized = false;
  private steeringHistory: SteeringContext['taskHistory'] = [];
  private performanceMetrics = {
    averageResponseTime: 2000,
    errorRate: 0.05,
    qualityScore: 0.85,
  };

  // 预定义的Agent能力映射
  private agentCapabilities = new Map<string, string[]>([
    ['code-agent', ['编程', '代码', '实现', '开发', '调试', 'bug', '函数', '类', '接口']],
    ['analysis-agent', ['分析', '解析', '研究', '评估', '检查', '审查', '比较']],
    ['documentation-agent', ['文档', '说明', '教程', '指南', '注释', 'README', '帮助']],
    ['test-agent', ['测试', '验证', '检验', '单元测试', '集成测试', 'coverage']],
    ['planning-agent', ['规划', '计划', '设计', '架构', '方案', '策略', '流程']],
    ['quality-agent', ['质量', '优化', '重构', '性能', '改进', '最佳实践']],
    ['git-agent', ['git', '版本', 'commit', 'branch', 'merge', '提交', '分支']],
    ['file-agent', ['文件', '目录', '路径', '读取', '写入', '删除', '创建']],
  ]);

  constructor(config: BladeConfig) {
    this.config = config;
  }

  /**
   * 初始化Steering控制器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('初始化Steering控制器...');
    this.isInitialized = true;
    this.log('Steering控制器初始化完成');
  }

  /**
   * 销毁Steering控制器
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.log('销毁Steering控制器...');
    this.steeringHistory = [];
    this.isInitialized = false;
    this.log('Steering控制器已销毁');
  }

  /**
   * 分析任务并提供Steering建议
   */
  public async analyzeTask(task: AgentTask): Promise<SteeringResult> {
    if (!this.isInitialized) {
      throw new Error('Steering控制器未初始化');
    }

    try {
      this.log(`分析任务Steering: ${task.id}`);

      // 1. 分析任务特征
      const taskFeatures = this.extractTaskFeatures(task);

      // 2. 匹配最佳Agent
      const agentMatch = this.findBestAgentMatch(taskFeatures);

      // 3. 生成调整建议
      const adjustments = this.generateAdjustments(task, taskFeatures);

      // 4. 计算置信度
      const confidence = this.calculateConfidence(taskFeatures, agentMatch, adjustments);

      // 5. 生成推理说明
      const reasoning = this.generateReasoning(taskFeatures, agentMatch, adjustments);

      const result: SteeringResult = {
        shouldDelegate: agentMatch.score > 0.7 && agentMatch.agentName !== 'main',
        recommendedAgent: agentMatch.agentName,
        adjustments,
        confidence,
        reasoning,
      };

      this.log(`Steering分析完成`, result);
      return result;
    } catch (error) {
      this.error(`Steering分析失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 提取任务特征
   */
  private extractTaskFeatures(task: AgentTask): string[] {
    const prompt = task.prompt.toLowerCase();
    const features: string[] = [];

    // 提取关键词特征
    for (const [agentName, keywords] of this.agentCapabilities) {
      for (const keyword of keywords) {
        if (prompt.includes(keyword)) {
          features.push(`${agentName}:${keyword}`);
        }
      }
    }

    // 分析任务类型特征
    if (prompt.includes('?') || prompt.includes('？')) {
      features.push('question');
    }

    if (prompt.includes('请') || prompt.includes('帮')) {
      features.push('request');
    }

    if (prompt.includes('如何') || prompt.includes('怎么')) {
      features.push('how-to');
    }

    return features;
  }

  /**
   * 查找最佳Agent匹配
   */
  private findBestAgentMatch(features: string[]): { agentName: string; score: number } {
    const agentScores = new Map<string, number>();

    // 初始化分数
    for (const agentName of this.agentCapabilities.keys()) {
      agentScores.set(agentName, 0);
    }
    agentScores.set('main', 0.5); // 主Agent默认分数

    // 计算匹配分数
    for (const feature of features) {
      if (feature.includes(':')) {
        const [agentName] = feature.split(':');
        const currentScore = agentScores.get(agentName) || 0;
        agentScores.set(agentName, currentScore + 0.2);
      }
    }

    // 找出最高分Agent
    let bestAgent = 'main';
    let bestScore = 0.5;

    for (const [agentName, score] of agentScores) {
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agentName;
      }
    }

    return { agentName: bestAgent, score: bestScore };
  }

  /**
   * 生成调整建议
   */
  private generateAdjustments(task: AgentTask, features: string[]): SteeringAdjustment[] {
    const adjustments: SteeringAdjustment[] = [];

    // 根据任务特征调整温度
    if (features.some(f => f.includes('code') || f.includes('实现'))) {
      adjustments.push({
        type: 'temperature',
        value: 0.1,
        reason: '代码生成任务需要更低的随机性',
      });
    } else if (features.some(f => f.includes('创意') || f.includes('brainstorm'))) {
      adjustments.push({
        type: 'temperature',
        value: 0.8,
        reason: '创意任务需要更高的随机性',
      });
    }

    // 根据任务复杂度调整模型
    if (features.length > 5) {
      adjustments.push({
        type: 'model',
        value: 'high-capacity',
        reason: '复杂任务需要更强大的模型',
      });
    }

    // 根据任务类型调整上下文窗口
    if (features.some(f => f.includes('analysis') || f.includes('分析'))) {
      adjustments.push({
        type: 'context_window',
        value: 'extended',
        reason: '分析任务需要更大的上下文窗口',
      });
    }

    return adjustments;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    features: string[],
    agentMatch: { agentName: string; score: number },
    adjustments: SteeringAdjustment[]
  ): number {
    let confidence = 0.5; // 基础置信度

    // Agent匹配置信度
    confidence += agentMatch.score * 0.3;

    // 特征数量置信度
    confidence += Math.min(features.length * 0.05, 0.2);

    // 调整数量置信度
    confidence += Math.min(adjustments.length * 0.03, 0.1);

    // 历史成功率影响
    const recentSuccess = this.getRecentSuccessRate();
    confidence += recentSuccess * 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    features: string[],
    agentMatch: { agentName: string; score: number },
    adjustments: SteeringAdjustment[]
  ): string {
    let reasoning = `任务特征分析: ${features.join(', ')}\n`;
    reasoning += `最佳Agent匹配: ${agentMatch.agentName} (得分: ${agentMatch.score.toFixed(2)})\n`;

    if (adjustments.length > 0) {
      reasoning += `建议调整:\n`;
      for (const adj of adjustments) {
        reasoning += `- ${adj.type}: ${adj.value} (${adj.reason})\n`;
      }
    }

    return reasoning;
  }

  /**
   * 获取最近成功率
   */
  private getRecentSuccessRate(): number {
    const recentTasks = this.steeringHistory.slice(-20);
    if (recentTasks.length === 0) {
      return 0.8; // 默认成功率
    }

    const successfulTasks = recentTasks.filter(t => t.success).length;
    return successfulTasks / recentTasks.length;
  }

  /**
   * 记录Steering结果
   */
  public recordSteeringResult(
    task: AgentTask,
    success: boolean,
    executionTime: number,
    adjustments: SteeringAdjustment[]
  ): void {
    this.steeringHistory.push({
      task,
      success,
      executionTime,
      adjustments,
    });

    // 更新性能指标
    this.updatePerformanceMetrics(executionTime, success);

    // 限制历史记录大小
    if (this.steeringHistory.length > 1000) {
      this.steeringHistory = this.steeringHistory.slice(-1000);
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(executionTime: number, success: boolean): void {
    // 更新平均响应时间
    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.averageResponseTime * 0.9 + executionTime * 0.1;

    // 更新错误率
    const newErrorRate = success ? 0 : 1;
    this.performanceMetrics.errorRate =
      this.performanceMetrics.errorRate * 0.95 + newErrorRate * 0.05;

    // 更新质量分数（简化实现）
    const qualityBonus = success ? 0.01 : -0.02;
    this.performanceMetrics.qualityScore = Math.max(
      0,
      Math.min(1, this.performanceMetrics.qualityScore + qualityBonus)
    );
  }

  /**
   * 获取Steering统计信息
   */
  public getSteeringStats() {
    const totalTasks = this.steeringHistory.length;
    const successfulTasks = this.steeringHistory.filter(t => t.success).length;
    const averageExecutionTime =
      totalTasks > 0
        ? this.steeringHistory.reduce((sum, t) => sum + t.executionTime, 0) / totalTasks
        : 0;

    return {
      totalTasks,
      successfulTasks,
      successRate: totalTasks > 0 ? successfulTasks / totalTasks : 0,
      averageExecutionTime,
      performanceMetrics: { ...this.performanceMetrics },
      adjustmentFrequency: this.getAdjustmentFrequency(),
    };
  }

  /**
   * 获取调整频率统计
   */
  private getAdjustmentFrequency(): Record<string, number> {
    const frequency: Record<string, number> = {};

    for (const record of this.steeringHistory) {
      for (const adjustment of record.adjustments) {
        frequency[adjustment.type] = (frequency[adjustment.type] || 0) + 1;
      }
    }

    return frequency;
  }

  /**
   * 日志记录
   */
  private log(message: string, data?: any): void {
    console.log(`[SteeringController] ${message}`, data || '');
  }

  /**
   * 错误记录
   */
  private error(message: string, error?: any): void {
    console.error(`[SteeringController] ${message}`, error || '');
  }
}
