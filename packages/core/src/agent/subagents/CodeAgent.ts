/**
 * 代码专家子Agent - 专门处理编程相关任务
 * 参考Claude Code的专业化Agent设计
 */

import type { BladeConfig } from '../../config/types/index.js';
import type { MainAgent } from '../MainAgent.js';
import { BaseSubAgent, type TaskRequest, type TaskResult } from '../SubAgentRegistry.js';

/**
 * 代码专家子Agent
 */
export class CodeAgent extends BaseSubAgent {
  private codePatterns = [
    '实现',
    '编写',
    '创建',
    '生成',
    '开发',
    'code',
    'function',
    'class',
    'method',
    '函数',
    '类',
    '方法',
    '接口',
    '模块',
  ];

  private codeLanguages = [
    'typescript',
    'javascript',
    'python',
    'java',
    'go',
    'rust',
    'c++',
    'c#',
    'php',
    'ruby',
    'swift',
  ];

  constructor(parentAgent: MainAgent, config: BladeConfig) {
    super(
      'code-agent',
      '代码生成和分析专家，擅长编程实现、代码审查、bug修复和架构设计',
      [
        'code-generation',
        'code-review',
        'bug-fixing',
        'refactoring',
        'architecture-design',
        'performance-optimization',
      ],
      parentAgent,
      config
    );
  }

  /**
   * 检查是否能处理任务
   */
  public canHandle(task: TaskRequest): boolean {
    const prompt = task.prompt.toLowerCase();

    // 检查代码相关关键词
    const hasCodeKeywords = this.codePatterns.some(pattern => prompt.includes(pattern));

    // 检查编程语言关键词
    const hasLanguageKeywords = this.codeLanguages.some(lang => prompt.includes(lang));

    // 检查代码符号
    const hasCodeSymbols = /[{}()[\];]/.test(task.prompt) || task.prompt.includes('```');

    return hasCodeKeywords || hasLanguageKeywords || hasCodeSymbols;
  }

  /**
   * 执行代码相关任务
   */
  public async executeTask(task: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      this.log(`执行代码任务: ${task.type}`);
      this.emit('taskStarted', task);

      // 分析任务类型
      const taskType = this.analyzeCodeTaskType(task);

      // 根据任务类型执行不同的处理逻辑
      let result: any;
      switch (taskType) {
        case 'generation':
          result = await this.handleCodeGeneration(task);
          break;
        case 'review':
          result = await this.handleCodeReview(task);
          break;
        case 'debugging':
          result = await this.handleDebugging(task);
          break;
        case 'refactoring':
          result = await this.handleRefactoring(task);
          break;
        case 'analysis':
          result = await this.handleCodeAnalysis(task);
          break;
        default:
          result = await this.handleGenericCodeTask(task);
      }

      const executionTime = Date.now() - startTime;

      this.log(`代码任务执行完成，耗时: ${executionTime}ms`);
      this.emit('taskCompleted', task, result);

      return {
        taskId: task.id,
        agentName: this.name,
        content: result,
        executionTime,
        metadata: {
          taskType,
          language: this.detectLanguage(task.prompt),
          complexity: this.assessComplexity(task.prompt),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.error(`代码任务执行失败: ${task.id}`, error);
      this.emit('taskFailed', task, error);
      throw error;
    }
  }

  /**
   * 分析代码任务类型
   */
  private analyzeCodeTaskType(task: TaskRequest): string {
    const prompt = task.prompt.toLowerCase();

    if (
      prompt.includes('实现') ||
      prompt.includes('生成') ||
      prompt.includes('创建') ||
      prompt.includes('implement') ||
      prompt.includes('create') ||
      prompt.includes('generate')
    ) {
      return 'generation';
    }

    if (prompt.includes('审查') || prompt.includes('检查') || prompt.includes('review')) {
      return 'review';
    }

    if (
      prompt.includes('调试') ||
      prompt.includes('bug') ||
      prompt.includes('错误') ||
      prompt.includes('debug') ||
      prompt.includes('fix')
    ) {
      return 'debugging';
    }

    if (
      prompt.includes('重构') ||
      prompt.includes('优化') ||
      prompt.includes('改进') ||
      prompt.includes('refactor') ||
      prompt.includes('optimize')
    ) {
      return 'refactoring';
    }

    if (prompt.includes('分析') || prompt.includes('解析') || prompt.includes('analyze')) {
      return 'analysis';
    }

    return 'generic';
  }

  /**
   * 处理代码生成任务
   */
  private async handleCodeGeneration(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个专业的代码生成专家。请根据用户需求生成高质量的代码。

要求：
1. 代码必须符合最佳实践和编码规范
2. 添加适当的注释和文档
3. 考虑错误处理和边界情况
4. 提供类型定义（如果适用）
5. 确保代码的可读性和可维护性

请生成完整、可运行的代码。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理代码审查任务
   */
  private async handleCodeReview(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个经验丰富的代码审查专家。请仔细审查提供的代码。

审查要点：
1. 代码逻辑正确性
2. 性能问题和优化建议
3. 安全性考虑
4. 代码风格和规范
5. 可维护性和可读性
6. 潜在的bug和边界情况

请提供详细的审查报告和改进建议。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理调试任务
   */
  private async handleDebugging(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个专业的代码调试专家。请帮助分析和解决代码问题。

调试流程：
1. 仔细分析错误信息和代码
2. 识别问题的根本原因
3. 提供具体的解决方案
4. 解释问题产生的原因
5. 给出预防类似问题的建议

请提供清晰的问题分析和解决步骤。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理重构任务
   */
  private async handleRefactoring(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个代码重构专家。请帮助改进和优化代码结构。

重构原则：
1. 保持功能不变
2. 提高代码可读性
3. 减少代码重复
4. 改善代码结构
5. 提升性能
6. 增强可维护性

请提供重构后的代码和详细的改进说明。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理代码分析任务
   */
  private async handleCodeAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个代码分析专家。请深入分析提供的代码。

分析维度：
1. 代码结构和架构
2. 算法复杂度
3. 设计模式使用
4. 依赖关系
5. 潜在风险点
6. 改进建议

请提供全面的代码分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理通用代码任务
   */
  private async handleGenericCodeTask(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个全能的代码专家，精通多种编程语言和技术栈。
请根据用户的具体需求提供专业的代码帮助。

专业能力：
- 代码生成和实现
- 代码审查和优化
- 问题诊断和调试
- 架构设计建议
- 最佳实践指导

请提供准确、实用的代码解决方案。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 检测编程语言
   */
  private detectLanguage(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    for (const language of this.codeLanguages) {
      if (lowerPrompt.includes(language)) {
        return language;
      }
    }

    // 通过代码特征检测
    if (prompt.includes('function') || prompt.includes('=>') || prompt.includes('const ')) {
      return 'javascript';
    }

    if (prompt.includes('def ') || prompt.includes('import ') || prompt.includes('from ')) {
      return 'python';
    }

    if (prompt.includes('interface') || prompt.includes('type ') || prompt.includes(': string')) {
      return 'typescript';
    }

    return 'unknown';
  }

  /**
   * 评估任务复杂度
   */
  private assessComplexity(prompt: string): 'low' | 'medium' | 'high' | 'very_high' {
    let complexityScore = 0;

    // 长度因子
    if (prompt.length > 500) complexityScore += 2;
    else if (prompt.length > 200) complexityScore += 1;

    // 关键词复杂度
    const complexKeywords = [
      '架构',
      '设计模式',
      '算法',
      '数据结构',
      '并发',
      '异步',
      '分布式',
      '微服务',
      'architecture',
      'algorithm',
      'concurrent',
      'distributed',
    ];

    for (const keyword of complexKeywords) {
      if (prompt.toLowerCase().includes(keyword)) {
        complexityScore += 1;
      }
    }

    // 多个要求
    const requirements = prompt.split(/[，,。.；;]/).filter(s => s.trim());
    if (requirements.length > 3) complexityScore += 1;
    if (requirements.length > 6) complexityScore += 2;

    // 返回复杂度级别
    if (complexityScore <= 1) return 'low';
    if (complexityScore <= 3) return 'medium';
    if (complexityScore <= 5) return 'high';
    return 'very_high';
  }

  /**
   * 子类初始化钩子
   */
  protected async onInitialize(): Promise<void> {
    this.log('代码专家Agent初始化...');

    // 这里可以初始化代码相关的工具和资源
    // 例如：语法检查器、代码格式化器等

    this.log('代码专家Agent初始化完成');
  }

  /**
   * 子类销毁钩子
   */
  protected async onDestroy(): Promise<void> {
    this.log('代码专家Agent销毁...');

    // 清理代码相关资源

    this.log('代码专家Agent已销毁');
  }
}
