import type { Agent } from '../agent/Agent.js';
import type { BladeConfig } from '../config/types.js';

export class PromptManager {
  private agent: Agent;
  private config: BladeConfig;
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private promptHistory: PromptExecution[] = [];
  private maxHistorySize: number;

  constructor(agent: Agent, config: BladeConfig) {
    this.agent = agent;
    this.config = config;
    this.maxHistorySize = 1000; // 默认保留1000条历史记录
  }

  public async initialize(): Promise<void> {
    // 注册默认提示词模板
    await this.registerDefaultTemplates();
    
    // 从配置加载自定义模板
    await this.loadCustomTemplates();
    
    console.log('提示词管理器初始化完成');
  }

  private async registerDefaultTemplates(): Promise<void> {
    // 注册通用聊天模板
    this.registerTemplate({
      id: 'chat',
      name: '通用聊天',
      description: '通用聊天提示词模板',
      content: `你是一个智能AI助手，请以友好和专业的态度回答用户的问题。

用户: {{message}}

请提供准确、有用的回答:`,
      variables: ['message'],
      category: 'chat',
      version: '1.0.0'
    });

    // 注册代码生成模板
    this.registerTemplate({
      id: 'code-generation',
      name: '代码生成',
      description: '代码生成提示词模板',
      content: `请根据以下要求生成{{language}}代码:

任务描述: {{task}}

要求:
{{#requirements}}
- {{.}}
{{/requirements}}

请生成高质量、可运行的代码:`,
      variables: ['language', 'task', 'requirements'],
      category: 'code',
      version: '1.0.0'
    });

    // 注册代码审查模板
    this.registerTemplate({
      id: 'code-review',
      name: '代码审查',
      description: '代码审查提示词模板',
      content: `请对以下代码进行审查并提供改进建议:

代码:
{{code}}

审查要点:
1. 代码质量和可读性
2. 性能优化建议
3. 安全性问题
4. 最佳实践
5. 潜在的bug

请提供详细的审查报告:`,
      variables: ['code'],
      category: 'code',
      version: '1.0.0'
    });

    // 注册文档生成模板
    this.registerTemplate({
      id: 'documentation',
      name: '文档生成',
      description: '文档生成提示词模板',
      content: `请为以下内容生成{{type}}文档:

内容:
{{content}}

目标受众: {{audience}}
详细程度: {{detailLevel}}

请生成结构清晰、内容完整的文档:`,
      variables: ['type', 'content', 'audience', 'detailLevel'],
      category: 'documentation',
      version: '1.0.0'
    });

    // 注册测试用例生成模板
    this.registerTemplate({
      id: 'test-generation',
      name: '测试用例生成',
      description: '测试用例生成提示词模板',
      content: `请为以下代码生成{{framework}}测试用例:

代码:
{{code}}

测试覆盖率目标: {{coverage}}%
测试类型: {{testTypes}}

请生成全面、可靠的测试用例:`,
      variables: ['framework', 'code', 'coverage', 'testTypes'],
      category: 'testing',
      version: '1.0.0'
    });
  }

  private async loadCustomTemplates(): Promise<void> {
    // 这里应该从配置或文件系统加载自定义模板
    // 暂时留空，后续实现
    console.log('加载自定义提示词模板');
  }

  public registerTemplate(template: PromptTemplate): void {
    if (!template.id || !template.content) {
      throw new Error('提示词模板必须包含ID和内容');
    }

    if (this.promptTemplates.has(template.id)) {
      console.warn(`提示词模板 "${template.id}" 已存在，将被覆盖`);
    }

    this.promptTemplates.set(template.id, template);
    console.log(`注册提示词模板: ${template.name} (${template.id})`);
  }

  public unregisterTemplate(id: string): void {
    if (!this.promptTemplates.has(id)) {
      throw new Error(`提示词模板 "${id}" 未找到`);
    }

    this.promptTemplates.delete(id);
    console.log(`注销提示词模板: ${id}`);
  }

  public getTemplate(id: string): PromptTemplate | undefined {
    return this.promptTemplates.get(id);
  }

  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.promptTemplates.values());
  }

  public getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.promptTemplates.values()).filter(
      template => template.category === category
    );
  }

  public renderTemplate(templateId: string, variables: Record<string, any> = {}): string {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      throw new Error(`提示词模板 "${templateId}" 未找到`);
    }

    // 简单的模板渲染实现
    let rendered = template.content;
    
    // 替换变量
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    // 处理循环（简单的实现）
    rendered = this.processLoops(rendered, variables);
    
    // 移除未替换的占位符
    rendered = rendered.replace(/{{[^}]+}}/g, '');
    
    return rendered.trim();
  }

  private processLoops(content: string, variables: Record<string, any>): string {
    // 简单的循环处理实现
    const loopRegex = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
    let result = content;
    
    let match;
    while ((match = loopRegex.exec(content)) !== null) {
      const [, variableName, template] = match;
      const values = variables[variableName];
      
      if (Array.isArray(values)) {
        let replacement = '';
        for (const value of values) {
          let itemTemplate = template;
          if (typeof value === 'object') {
            for (const [key, val] of Object.entries(value)) {
              const placeholder = `{{${key}}}`;
              itemTemplate = itemTemplate.replace(new RegExp(placeholder, 'g'), String(val));
            }
          } else {
            itemTemplate = itemTemplate.replace(/{{\.}}/g, String(value));
          }
          replacement += itemTemplate;
        }
        result = result.replace(match[0], replacement);
      }
    }
    
    return result;
  }

  public async executePrompt(templateId: string, variables: Record<string, any> = {}, options: PromptExecutionOptions = {}): Promise<string> {
    try {
      // 渲染提示词
      const prompt = this.renderTemplate(templateId, variables);
      
      // 记录执行历史
      const execution: PromptExecution = {
        id: this.generateExecutionId(),
        templateId,
        variables,
        prompt,
        createdAt: Date.now(),
        status: 'pending'
      };
      
      this.promptHistory.push(execution);
      
      // 限制历史记录大小
      if (this.promptHistory.length > this.maxHistorySize) {
        this.promptHistory = this.promptHistory.slice(-this.maxHistorySize);
      }
      
      // 执行提示词
      execution.status = 'running';
      execution.startedAt = Date.now();
      
      const response = await this.agent.chat(prompt, {
        temperature: options.temperature || this.config.llm.temperature,
        maxTokens: options.maxTokens || this.config.llm.maxTokens,
        topP: options.topP || this.config.llm.topP,
        stream: options.stream !== false
      });
      
      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.response = response;
      execution.executionTime = execution.completedAt - execution.startedAt;
      
      console.log(`提示词执行完成: ${templateId} (${execution.executionTime}ms)`);
      
      return response;
    } catch (error) {
      console.error(`提示词执行失败: ${templateId}`, error);
      throw error;
    }
  }

  public async executeCustomPrompt(prompt: string, options: PromptExecutionOptions = {}): Promise<string> {
    try {
      const execution: PromptExecution = {
        id: this.generateExecutionId(),
        templateId: 'custom',
        variables: {},
        prompt,
        createdAt: Date.now(),
        status: 'pending'
      };
      
      this.promptHistory.push(execution);
      
      if (this.promptHistory.length > this.maxHistorySize) {
        this.promptHistory = this.promptHistory.slice(-this.maxHistorySize);
      }
      
      execution.status = 'running';
      execution.startedAt = Date.now();
      
      const response = await this.agent.chat(prompt, {
        temperature: options.temperature || this.config.llm.temperature,
        maxTokens: options.maxTokens || this.config.llm.maxTokens,
        topP: options.topP || this.config.llm.topP,
        stream: options.stream !== false
      });
      
      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.response = response;
      execution.executionTime = execution.completedAt - execution.startedAt;
      
      console.log(`自定义提示词执行完成 (${execution.executionTime}ms)`);
      
      return response;
    } catch (error) {
      console.error('自定义提示词执行失败:', error);
      throw error;
    }
  }

  public getExecutionHistory(limit: number = 50): PromptExecution[] {
    return this.promptHistory.slice(-limit);
  }

  public getTemplateUsageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const execution of this.promptHistory) {
      stats[execution.templateId] = (stats[execution.templateId] || 0) + 1;
    }
    
    return stats;
  }

  public async optimizePrompt(templateId: string, variables: Record<string, any> = {}): Promise<string> {
    // 这里应该实现提示词优化逻辑
    // 暂时返回原始提示词，后续实现
    return this.renderTemplate(templateId, variables);
  }

  public async analyzePromptEffectiveness(templateId: string): Promise<PromptAnalysis> {
    const executions = this.promptHistory.filter(e => e.templateId === templateId);
    
    if (executions.length === 0) {
      return {
        templateId,
        executionCount: 0,
        averageExecutionTime: 0,
        successRate: 0,
        averageResponseLength: 0
      };
    }
    
    const successfulExecutions = executions.filter(e => e.status === 'completed');
    const totalExecutionTime = successfulExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0);
    const totalResponseLength = successfulExecutions.reduce((sum, e) => sum + (e.response?.length || 0), 0);
    
    return {
      templateId,
      executionCount: executions.length,
      averageExecutionTime: totalExecutionTime / successfulExecutions.length,
      successRate: successfulExecutions.length / executions.length,
      averageResponseLength: totalResponseLength / successfulExecutions.length
    };
  }

  private generateExecutionId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 类型定义
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  variables: string[];
  category: string;
  version: string;
  tags?: string[];
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PromptExecution {
  id: string;
  templateId: string;
  variables: Record<string, any>;
  prompt: string;
  response?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  executionTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

interface PromptExecutionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

interface PromptAnalysis {
  templateId: string;
  executionCount: number;
  averageExecutionTime: number;
  successRate: number;
  averageResponseLength: number;
}