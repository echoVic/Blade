/**
 * 分析专家子Agent - 专门处理分析和研究任务
 */

import type { BladeConfig } from '../../config/types/index.js';
import type { MainAgent } from '../MainAgent.js';
import { BaseSubAgent, type TaskRequest, type TaskResult } from '../SubAgentRegistry.js';

/**
 * 分析专家子Agent
 */
export class AnalysisAgent extends BaseSubAgent {
  private analysisPatterns = [
    '分析',
    '解析',
    '研究',
    '评估',
    '检查',
    '审查',
    'analyze',
    'research',
    'evaluate',
    'examine',
    'study',
    '比较',
    '对比',
    '总结',
    '归纳',
    '梳理',
  ];

  private analysisTypes = [
    'data-analysis',
    'code-analysis',
    'performance-analysis',
    'security-analysis',
    'business-analysis',
    'technical-analysis',
    'requirement-analysis',
  ];

  constructor(parentAgent: MainAgent, config: BladeConfig) {
    super(
      'analysis-agent',
      '分析和研究专家，擅长数据分析、代码分析、需求分析和技术调研',
      [
        'data-analysis',
        'code-analysis',
        'performance-analysis',
        'security-analysis',
        'requirement-analysis',
        'technical-research',
        'comparative-analysis',
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

    // 检查分析相关关键词
    const hasAnalysisKeywords = this.analysisPatterns.some(pattern => prompt.includes(pattern));

    // 检查问号（通常表示需要分析回答）
    const hasQuestionMarks = prompt.includes('?') || prompt.includes('？');

    // 检查分析类型关键词
    const hasAnalysisTypes = this.analysisTypes.some(type =>
      prompt.includes(type.replace('-', ''))
    );

    return hasAnalysisKeywords || (hasQuestionMarks && prompt.length > 20) || hasAnalysisTypes;
  }

  /**
   * 执行分析任务
   */
  public async executeTask(task: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      this.log(`执行分析任务: ${task.type}`);
      this.emit('taskStarted', task);

      // 分析任务类型
      const analysisType = this.detectAnalysisType(task);

      // 根据分析类型执行不同的处理逻辑
      let result: any;
      switch (analysisType) {
        case 'data-analysis':
          result = await this.handleDataAnalysis(task);
          break;
        case 'code-analysis':
          result = await this.handleCodeAnalysis(task);
          break;
        case 'performance-analysis':
          result = await this.handlePerformanceAnalysis(task);
          break;
        case 'security-analysis':
          result = await this.handleSecurityAnalysis(task);
          break;
        case 'requirement-analysis':
          result = await this.handleRequirementAnalysis(task);
          break;
        case 'comparative-analysis':
          result = await this.handleComparativeAnalysis(task);
          break;
        default:
          result = await this.handleGenericAnalysis(task);
      }

      const executionTime = Date.now() - startTime;

      this.log(`分析任务执行完成，耗时: ${executionTime}ms`);
      this.emit('taskCompleted', task, result);

      return {
        taskId: task.id,
        agentName: this.name,
        content: result,
        executionTime,
        metadata: {
          analysisType,
          complexity: this.assessAnalysisComplexity(task.prompt),
          scope: this.determineAnalysisScope(task.prompt),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.error(`分析任务执行失败: ${task.id}`, error);
      this.emit('taskFailed', task, error);
      throw error;
    }
  }

  /**
   * 检测分析类型
   */
  private detectAnalysisType(task: TaskRequest): string {
    const prompt = task.prompt.toLowerCase();

    if (prompt.includes('数据') || prompt.includes('统计') || prompt.includes('data')) {
      return 'data-analysis';
    }

    if (prompt.includes('代码') || prompt.includes('代码库') || prompt.includes('code')) {
      return 'code-analysis';
    }

    if (prompt.includes('性能') || prompt.includes('优化') || prompt.includes('performance')) {
      return 'performance-analysis';
    }

    if (prompt.includes('安全') || prompt.includes('漏洞') || prompt.includes('security')) {
      return 'security-analysis';
    }

    if (prompt.includes('需求') || prompt.includes('要求') || prompt.includes('requirement')) {
      return 'requirement-analysis';
    }

    if (prompt.includes('比较') || prompt.includes('对比') || prompt.includes('compare')) {
      return 'comparative-analysis';
    }

    return 'generic';
  }

  /**
   * 处理数据分析
   */
  private async handleDataAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个专业的数据分析师。请对提供的数据进行深入分析。

分析框架：
1. 数据概览和基本统计
2. 数据质量评估
3. 趋势和模式识别  
4. 异常值检测
5. 相关性分析
6. 结论和建议

请提供结构化的分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理代码分析
   */
  private async handleCodeAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个专业的代码分析专家。请对提供的代码进行全面分析。

分析维度：
1. 代码结构和架构分析
2. 算法复杂度评估
3. 设计模式识别
4. 代码质量评分
5. 潜在问题识别
6. 改进建议

请提供详细的代码分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理性能分析
   */
  private async handlePerformanceAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个性能分析专家。请分析系统或代码的性能特征。

性能分析要点：
1. 性能瓶颈识别
2. 资源使用分析
3. 算法效率评估
4. 内存使用模式
5. I/O操作优化
6. 并发性能分析
7. 优化建议

请提供专业的性能分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理安全分析
   */
  private async handleSecurityAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个网络安全专家。请对系统或代码进行安全分析。

安全分析框架：
1. 漏洞识别和风险评估
2. 攻击面分析
3. 数据安全检查
4. 访问控制评估
5. 加密和认证机制
6. 安全配置审查
7. 修复建议

请提供全面的安全分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理需求分析
   */
  private async handleRequirementAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个需求分析专家。请对用户需求进行深入分析。

需求分析方法：
1. 需求理解和澄清
2. 功能需求分解
3. 非功能需求识别
4. 约束条件分析
5. 优先级评估
6. 可行性分析
7. 实现建议

请提供结构化的需求分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理对比分析
   */
  private async handleComparativeAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个比较分析专家。请对不同方案或选项进行客观比较。

比较分析框架：
1. 比较维度确定
2. 优缺点分析
3. 适用场景评估
4. 成本效益分析
5. 风险评估
6. 推荐方案
7. 决策建议

请提供公正客观的比较分析报告。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 处理通用分析任务
   */
  private async handleGenericAnalysis(task: TaskRequest): Promise<string> {
    const systemPrompt = `你是一个全能分析专家，具备多领域的分析能力。
请根据用户需求进行深入分析。

分析能力：
- 逻辑推理和批判性思维
- 数据解读和模式识别  
- 问题诊断和根因分析
- 趋势预测和风险评估
- 多角度综合分析

请提供专业、客观的分析结果。`;

    return await this.getContextManager().processConversation([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.prompt },
    ]);
  }

  /**
   * 评估分析复杂度
   */
  private assessAnalysisComplexity(prompt: string): 'simple' | 'moderate' | 'complex' | 'expert' {
    let complexityScore = 0;

    // 数据量指标
    if (prompt.includes('大量') || prompt.includes('批量') || prompt.includes('所有')) {
      complexityScore += 2;
    }

    // 分析深度指标
    const depthKeywords = ['深入', '全面', '详细', '彻底', 'comprehensive', 'thorough'];
    if (depthKeywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
      complexityScore += 2;
    }

    // 多维度分析
    const dimensions = prompt.split(/[，,]/).length;
    if (dimensions > 3) complexityScore += 1;
    if (dimensions > 6) complexityScore += 2;

    // 专业术语密度
    const technicalTerms = [
      '算法',
      '架构',
      '模型',
      '框架',
      '协议',
      '标准',
      'algorithm',
      'architecture',
      'model',
      'framework',
      'protocol',
    ];
    const termCount = technicalTerms.filter(term => prompt.toLowerCase().includes(term)).length;
    complexityScore += Math.min(termCount, 3);

    if (complexityScore <= 2) return 'simple';
    if (complexityScore <= 4) return 'moderate';
    if (complexityScore <= 6) return 'complex';
    return 'expert';
  }

  /**
   * 确定分析范围
   */
  private determineAnalysisScope(prompt: string): 'narrow' | 'focused' | 'broad' | 'comprehensive' {
    const lowerPrompt = prompt.toLowerCase();

    if (
      lowerPrompt.includes('具体') ||
      lowerPrompt.includes('特定') ||
      lowerPrompt.includes('单个')
    ) {
      return 'narrow';
    }

    if (
      lowerPrompt.includes('整体') ||
      lowerPrompt.includes('全面') ||
      lowerPrompt.includes('所有')
    ) {
      return 'comprehensive';
    }

    if (
      lowerPrompt.includes('多个') ||
      lowerPrompt.includes('各种') ||
      lowerPrompt.includes('不同')
    ) {
      return 'broad';
    }

    return 'focused';
  }

  /**
   * 子类初始化钩子
   */
  protected async onInitialize(): Promise<void> {
    this.log('分析专家Agent初始化...');

    // 这里可以初始化分析相关的工具和资源
    // 例如：数据处理工具、统计分析库等

    this.log('分析专家Agent初始化完成');
  }

  /**
   * 子类销毁钩子
   */
  protected async onDestroy(): Promise<void> {
    this.log('分析专家Agent销毁...');

    // 清理分析相关资源

    this.log('分析专家Agent已销毁');
  }
}
