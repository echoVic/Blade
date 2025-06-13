/**
 * Agent 工厂 - 创建和配置 Agent 实例
 */

import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { QwenChatModel } from '../models/QwenChatModel.js';
import { VolcEngineChatModel } from '../models/VolcEngineChatModel.js';
import { BladeToolkit } from '../tools/BladeToolkit.js';
import { getAllBuiltinTools } from '../tools/builtin/index.js';
import { BladeAgent } from './BladeAgent.js';
import type { BladeAgentConfig } from './types.js';

/**
 * Agent 配置预设
 */
export const AgentPresets = {
  /** 通用助手 */
  GENERAL_ASSISTANT: {
    name: 'GeneralAssistant',
    description: '通用智能助手，可以处理各种任务',
    systemPrompt: `你是一个智能助手，能够通过思考和使用工具来帮助用户解决问题。

请遵循以下原则：
1. 仔细分析用户的需求
2. 选择合适的工具来完成任务
3. 给出清晰、准确的回答
4. 如果不确定，请说明并寻求澄清

你可以使用多种工具，包括文件操作、网络请求、时间处理等。`,
    maxIterations: 10,
    toolConfirmation: { enabled: false },
  },

  /** 代码助手 */
  CODE_ASSISTANT: {
    name: 'CodeAssistant',
    description: '专业的代码助手，专注于编程相关任务',
    systemPrompt: `你是一个专业的代码助手，专门帮助用户处理编程相关的任务。

专长领域：
- 代码分析和审查
- 文件操作和管理
- 项目结构分析
- 代码重构建议
- 技术文档生成

请始终：
1. 提供准确的技术信息
2. 使用最佳实践
3. 解释你的决策理由
4. 在操作文件前确认用户意图`,
    maxIterations: 15,
    toolConfirmation: { enabled: true },
  },

  /** 数据助手 */
  DATA_ASSISTANT: {
    name: 'DataAssistant',
    description: '数据处理和分析助手',
    systemPrompt: `你是一个数据分析助手，专门处理数据相关的任务。

能力范围：
- 数据获取和处理
- API 调用和数据提取
- 文件读写和格式转换
- 简单的数据分析

工作方式：
1. 理解数据需求
2. 选择合适的数据源
3. 处理和清理数据
4. 提供分析结果`,
    maxIterations: 12,
    toolConfirmation: { enabled: false },
  },
} as const;

/**
 * Agent 工厂类
 */
export class AgentFactory {
  /**
   * 创建通用 Agent
   */
  static createAgent(config: BladeAgentConfig): BladeAgent {
    return new BladeAgent(config);
  }

  /**
   * 使用预设创建 Agent
   */
  static createFromPreset(
    preset: keyof typeof AgentPresets,
    llm: BaseLanguageModel,
    options?: {
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    const presetConfig = AgentPresets[preset];

    // 创建默认工具包
    const toolkit = options?.toolkit || AgentFactory.createDefaultToolkit();

    const config: BladeAgentConfig = {
      ...presetConfig,
      llm,
      toolkit,
      ...options?.overrides,
    };

    return new BladeAgent(config);
  }

  /**
   * 创建千问 Agent
   */
  static createQwenAgent(
    preset: keyof typeof AgentPresets = 'GENERAL_ASSISTANT',
    options?: {
      apiKey?: string;
      modelName?: string;
      baseURL?: string;
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    const llm = new QwenChatModel({
      apiKey: options?.apiKey || process.env.QWEN_API_KEY,
      modelName: options?.modelName || 'qwen-turbo',
      baseURL: options?.baseURL,
    });

    return AgentFactory.createFromPreset(preset, llm, options);
  }

  /**
   * 创建火山引擎 Agent
   */
  static createVolcEngineAgent(
    preset: keyof typeof AgentPresets = 'GENERAL_ASSISTANT',
    options?: {
      apiKey?: string;
      modelName?: string;
      baseURL?: string;
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    const llm = new VolcEngineChatModel({
      apiKey: options?.apiKey || process.env.VOLCENGINE_API_KEY,
      modelName: options?.modelName || 'ep-20250530171222-q42h8',
      baseURL: options?.baseURL,
    });

    return AgentFactory.createFromPreset(preset, llm, options);
  }

  /**
   * 创建默认工具包
   */
  static createDefaultToolkit(): BladeToolkit {
    const toolkit = new BladeToolkit({
      name: 'DefaultToolkit',
      description: '默认工具包',
      enableConfirmation: false,
    });

    // 注册所有内置工具
    const builtinTools = getAllBuiltinTools();
    toolkit.registerTools(builtinTools);

    return toolkit;
  }

  /**
   * 创建自定义工具包
   */
  static createCustomToolkit(config: {
    name: string;
    description?: string;
    enableConfirmation?: boolean;
    tools?: string[]; // 指定要包含的工具名称
  }): BladeToolkit {
    const toolkit = new BladeToolkit({
      name: config.name,
      description: config.description || '自定义工具包',
      enableConfirmation: config.enableConfirmation || false,
    });

    const allTools = getAllBuiltinTools();

    if (config.tools) {
      // 只注册指定的工具
      const selectedTools = allTools.filter(tool => config.tools!.includes(tool.name));
      toolkit.registerTools(selectedTools);
    } else {
      // 注册所有工具
      toolkit.registerTools(allTools);
    }

    return toolkit;
  }

  /**
   * 创建专用工具包
   */
  static createSpecializedToolkit(type: 'filesystem' | 'network' | 'utility'): BladeToolkit {
    const toolkit = new BladeToolkit({
      name: `${type}Toolkit`,
      description: `${type} 专用工具包`,
      enableConfirmation: type === 'filesystem', // 文件系统工具需要确认
    });

    const allTools = getAllBuiltinTools();
    const filteredTools = allTools.filter(tool => tool.category === type);

    toolkit.registerTools(filteredTools);
    return toolkit;
  }

  /**
   * 创建带记忆的 Agent
   */
  static createMemoryAgent(
    preset: keyof typeof AgentPresets,
    llm: BaseLanguageModel,
    options?: {
      maxMessages?: number;
      contextWindow?: number;
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    const memoryConfig = {
      memory: {
        enabled: true,
        maxMessages: options?.maxMessages || 100,
        contextWindow: options?.contextWindow || 4000,
      },
    };

    return AgentFactory.createFromPreset(preset, llm, {
      toolkit: options?.toolkit,
      overrides: {
        ...memoryConfig,
        ...options?.overrides,
      },
    });
  }

  /**
   * 创建流式 Agent
   */
  static createStreamingAgent(
    preset: keyof typeof AgentPresets,
    llm: BaseLanguageModel,
    options?: {
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    return AgentFactory.createFromPreset(preset, llm, {
      toolkit: options?.toolkit,
      overrides: {
        streaming: true,
        ...options?.overrides,
      },
    });
  }

  /**
   * 创建调试模式 Agent
   */
  static createDebugAgent(
    preset: keyof typeof AgentPresets,
    llm: BaseLanguageModel,
    options?: {
      toolkit?: BladeToolkit;
      overrides?: Partial<BladeAgentConfig>;
    }
  ): BladeAgent {
    return AgentFactory.createFromPreset(preset, llm, {
      toolkit: options?.toolkit,
      overrides: {
        debug: true,
        ...options?.overrides,
      },
    });
  }

  /**
   * 获取可用预设列表
   */
  static getAvailablePresets(): Array<{ name: keyof typeof AgentPresets; config: any }> {
    return Object.entries(AgentPresets).map(([name, config]) => ({
      name: name as keyof typeof AgentPresets,
      config,
    }));
  }

  /**
   * 验证 Agent 配置
   */
  static validateConfig(config: BladeAgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('Agent name is required');
    }

    if (!config.llm) {
      errors.push('Language model is required');
    }

    if (!config.toolkit) {
      errors.push('Toolkit is required');
    }

    if (config.maxIterations && config.maxIterations < 1) {
      errors.push('maxIterations must be greater than 0');
    }

    if (config.maxExecutionTime && config.maxExecutionTime < 1000) {
      errors.push('maxExecutionTime must be at least 1000ms');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 创建 Agent 构建器
   */
  static builder(): AgentBuilder {
    return new AgentBuilder();
  }
}

/**
 * Agent 构建器 - 提供流式的 Agent 配置体验
 */
export class AgentBuilder {
  private config: Partial<BladeAgentConfig> = {};

  name(name: string): AgentBuilder {
    this.config.name = name;
    return this;
  }

  description(description: string): AgentBuilder {
    this.config.description = description;
    return this;
  }

  systemPrompt(prompt: string): AgentBuilder {
    this.config.systemPrompt = prompt;
    return this;
  }

  llm(model: BaseLanguageModel): AgentBuilder {
    this.config.llm = model;
    return this;
  }

  toolkit(toolkit: BladeToolkit): AgentBuilder {
    this.config.toolkit = toolkit;
    return this;
  }

  maxIterations(count: number): AgentBuilder {
    this.config.maxIterations = count;
    return this;
  }

  maxExecutionTime(ms: number): AgentBuilder {
    this.config.maxExecutionTime = ms;
    return this;
  }

  enableToolConfirmation(enabled: boolean = true): AgentBuilder {
    this.config.toolConfirmation = { enabled };
    return this;
  }

  enableMemory(maxMessages: number = 100, contextWindow: number = 4000): AgentBuilder {
    this.config.memory = {
      enabled: true,
      maxMessages,
      contextWindow,
    };
    return this;
  }

  enableStreaming(enabled: boolean = true): AgentBuilder {
    this.config.streaming = enabled;
    return this;
  }

  enableDebug(enabled: boolean = true): AgentBuilder {
    this.config.debug = enabled;
    return this;
  }

  build(): BladeAgent {
    if (!this.config.name) {
      throw new Error('Agent name is required');
    }
    if (!this.config.llm) {
      throw new Error('Language model is required');
    }
    if (!this.config.toolkit) {
      this.config.toolkit = AgentFactory.createDefaultToolkit();
    }

    const validation = AgentFactory.validateConfig(this.config as BladeAgentConfig);
    if (!validation.valid) {
      throw new Error(`Agent configuration is invalid: ${validation.errors.join(', ')}`);
    }

    return new BladeAgent(this.config as BladeAgentConfig);
  }
}
