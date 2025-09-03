import type { Agent } from '../agent/Agent.js';
import type { BladeConfig } from '../config/types/index.js';

export class ContentGenerator {
  private agent: Agent;
  private config: BladeConfig;

  constructor(agent: Agent, config: BladeConfig) {
    this.agent = agent;
    this.config = config;
  }

  public async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    try {
      const fullPrompt = this.buildTextPrompt(prompt, options);
      const response = await this.agent.chat(fullPrompt);
      return this.postProcessText(response, options);
    } catch (error) {
      console.error('文本生成失败:', error);
      throw error;
    }
  }

  public async generateCode(task: string, language: string = 'javascript', options: GenerateCodeOptions = {}): Promise<string> {
    try {
      const fullPrompt = this.buildCodePrompt(task, language, options);
      const response = await this.agent.chat(fullPrompt);
      return this.postProcessCode(response, language, options);
    } catch (error) {
      console.error('代码生成失败:', error);
      throw error;
    }
  }

  public async generateDocumentation(content: string, type: string = 'api', options: GenerateDocOptions = {}): Promise<string> {
    try {
      const fullPrompt = this.buildDocPrompt(content, type, options);
      const response = await this.agent.chat(fullPrompt);
      return this.postProcessDocumentation(response, type, options);
    } catch (error) {
      console.error('文档生成失败:', error);
      throw error;
    }
  }

  public async generateTest_cases(implementation: string, framework: string = 'jest', options: GenerateTestOptions = {}): Promise<string> {
    try {
      const fullPrompt = this.buildTestPrompt(implementation, framework, options);
      const response = await this.agent.chat(fullPrompt);
      return this.postProcessTests(response, framework, options);
    } catch (error) {
      console.error('测试用例生成失败:', error);
      throw error;
    }
  }

  public async generateExplanation(code: string, options: GenerateExplanationOptions = {}): Promise<string> {
    try {
      const fullPrompt = this.buildExplanationPrompt(code, options);
      const response = await this.agent.chat(fullPrompt);
      return this.postProcessExplanation(response, options);
    } catch (error) {
      console.error('代码解释生成失败:', error);
      throw error;
    }
  }

  private buildTextPrompt(prompt: string, options: GenerateTextOptions): string {
    let fullPrompt = prompt;
    
    if (options.context) {
      fullPrompt = `上下文: ${options.context}\n\n${prompt}`;
    }
    
    if (options.style) {
      fullPrompt = `请以${options.style}的风格回答:\n\n${fullPrompt}`;
    }
    
    if (options.length) {
      fullPrompt = `请生成${options.length}字左右的内容:\n\n${fullPrompt}`;
    }
    
    return fullPrompt;
  }

  private buildCodePrompt(task: string, language: string, options: GenerateCodeOptions): string {
    let fullPrompt = `请用${language}生成代码来完成以下任务:\n\n${task}`;
    
    if (options.framework) {
      fullPrompt += `\n\n使用框架: ${options.framework}`;
    }
    
    if (options.requirements) {
      fullPrompt += `\n\n要求:\n${options.requirements.join('\n')}`;
    }
    
    if (options.example) {
      fullPrompt += `\n\n示例:\n${options.example}`;
    }
    
    return fullPrompt;
  }

  private buildDocPrompt(content: string, type: string, options: GenerateDocOptions): string {
    let fullPrompt = `请为以下内容生成${type}文档:\n\n${content}`;
    
    if (options.format) {
      fullPrompt += `\n\n文档格式: ${options.format}`;
    }
    
    if (options.audience) {
      fullPrompt += `\n\n目标受众: ${options.audience}`;
    }
    
    if (options.detailLevel) {
      fullPrompt += `\n\n详细程度: ${options.detailLevel}`;
    }
    
    return fullPrompt;
  }

  private buildTestPrompt(implementation: string, framework: string, options: GenerateTestOptions): string {
    let fullPrompt = `请为以下${framework}代码生成测试用例:\n\n${implementation}`;
    
    if (options.coverage) {
      fullPrompt += `\n\n测试覆盖率目标: ${options.coverage}%`;
    }
    
    if (options.testTypes) {
      fullPrompt += `\n\n测试类型: ${options.testTypes.join(', ')}`;
    }
    
    if (options.edgeCases) {
      fullPrompt += `\n\n需要覆盖的边界情况: ${options.edgeCases.join(', ')}`;
    }
    
    return fullPrompt;
  }

  private buildExplanationPrompt(code: string, options: GenerateExplanationOptions): string {
    let fullPrompt = `请解释以下代码的作用和实现原理:\n\n${code}`;
    
    if (options.detailLevel) {
      fullPrompt += `\n\n详细程度: ${options.detailLevel}`;
    }
    
    if (options.targetAudience) {
      fullPrompt += `\n\n目标读者: ${options.targetAudience}`;
    }
    
    if (options.focusAreas) {
      fullPrompt += `\n\n重点关注: ${options.focusAreas.join(', ')}`;
    }
    
    return fullPrompt;
  }

  private postProcessText(text: string, options: GenerateTextOptions): string {
    // 移除多余的空白行
    let result = text.trim();
    
    // 如果指定了最大长度，进行截断
    if (options.maxLength && result.length > options.maxLength) {
      result = result.substring(0, options.maxLength) + '...';
    }
    
    return result;
  }

  private postProcessCode(code: string, language: string, options: GenerateCodeOptions): string {
    // 移除代码块标记
    let result = code.replace(/```[a-zA-Z]*\n?/g, '').trim();
    
    // 根据语言进行特定处理
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        // 确保代码以分号结尾（如果需要）
        if (options.semicolons !== false && !result.endsWith(';') && !result.endsWith('}')) {
          result += ';';
        }
        break;
      case 'python':
        // 确保正确的缩进
        result = result.replace(/\t/g, '    ');
        break;
    }
    
    return result;
  }

  private postProcessDocumentation(doc: string, type: string, options: GenerateDocOptions): string {
    // 移除多余的空白行
    let result = doc.trim();
    
    // 根据文档类型进行特定处理
    switch (type.toLowerCase()) {
      case 'api':
        // 确保API文档包含必要的部分
        if (!result.includes('## API') && !result.includes('# API')) {
          result = `## API文档\n\n${result}`;
        }
        break;
      case 'readme':
        // 确保README包含标题
        if (!result.startsWith('# ')) {
          result = `# 项目文档\n\n${result}`;
        }
        break;
    }
    
    return result;
  }

  private postProcessTests(tests: string, framework: string, options: GenerateTestOptions): string {
    // 移除代码块标记
    let result = tests.replace(/```[a-zA-Z]*\n?/g, '').trim();
    
    // 根据测试框架进行特定处理
    switch (framework.toLowerCase()) {
      case 'jest':
        // 确保测试文件包含必要的导入
        if (!result.includes('import ') && !result.includes('require(')) {
          result = `import { test, expect } from '@jest/globals';\n\n${result}`;
        }
        break;
      case 'mocha':
        // 确保测试文件包含必要的导入
        if (!result.includes('import ') && !result.includes('require(')) {
          result = `import { describe, it } from 'mocha';\nimport { expect } from 'chai';\n\n${result}`;
        }
        break;
    }
    
    return result;
  }

  private postProcessExplanation(explanation: string, options: GenerateExplanationOptions): string {
    // 移除多余的空白行
    return explanation.trim();
  }
}

// 选项接口
interface GenerateTextOptions {
  context?: string;
  style?: string;
  length?: number;
  maxLength?: number;
}

interface GenerateCodeOptions {
  framework?: string;
  requirements?: string[];
  example?: string;
  semicolons?: boolean;
}

interface GenerateDocOptions {
  format?: string;
  audience?: string;
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
}

interface GenerateTestOptions {
  coverage?: number;
  testTypes?: string[];
  edgeCases?: string[];
}

interface GenerateExplanationOptions {
  detailLevel?: 'basic' | 'intermediate' | 'advanced';
  targetAudience?: string;
  focusAreas?: string[];
}