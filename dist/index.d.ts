import * as events from 'events';

/**
 * 组件接口
 */
interface Component {
    name: string;
    init(): Promise<void>;
    destroy(): Promise<void>;
}
/**
 * Agent 配置选项
 */
interface AgentOptions {
    debug?: boolean;
    components?: Component[];
}
/**
 * Agent 主类 - 负责协调各组件工作，管理生命周期，处理用户输入和输出
 */
declare class Agent extends events.EventEmitter {
    private components;
    private initialized;
    private debug;
    /**
     * 创建 Agent 实例
     */
    constructor(options?: AgentOptions);
    /**
     * 注册组件
     */
    registerComponent(component: Component): void;
    /**
     * 获取已注册组件
     */
    getComponent<T extends Component>(name: string): T | undefined;
    /**
     * 初始化 Agent 及所有组件
     */
    init(): Promise<void>;
    /**
     * 销毁 Agent 及所有组件
     */
    destroy(): Promise<void>;
    /**
     * 处理用户输入
     */
    handleInput(prompt: string): Promise<string>;
    /**
     * 处理输出到用户
     */
    output(message: string, type?: 'info' | 'success' | 'warn' | 'error'): void;
    /**
     * 内部日志方法
     */
    private log;
    /**
     * 运行 Agent
     */
    run(): Promise<void>;
    /**
     * 停止 Agent
     */
    stop(): Promise<void>;
}

/**
 * 组件基类
 * 提供组件的基本实现，可被具体组件继承
 */
declare abstract class BaseComponent implements Component {
    private _name;
    constructor(name: string);
    /**
     * 获取组件名称
     */
    get name(): string;
    /**
     * 初始化组件
     * 子类应重写此方法实现具体的初始化逻辑
     */
    init(): Promise<void>;
    /**
     * 销毁组件
     * 子类应重写此方法实现具体的销毁逻辑
     */
    destroy(): Promise<void>;
}

/**
 * 日志组件
 * 示例组件，用于处理和记录系统日志
 */
declare class LoggerComponent extends BaseComponent {
    private enabled;
    private logLevel;
    constructor(logLevel?: 'debug' | 'info' | 'warn' | 'error');
    /**
     * 初始化日志组件
     */
    init(): Promise<void>;
    /**
     * 销毁日志组件
     */
    destroy(): Promise<void>;
    /**
     * 记录调试信息
     */
    debug(message: string): void;
    /**
     * 记录一般信息
     */
    info(message: string): void;
    /**
     * 记录警告信息
     */
    warn(message: string): void;
    /**
     * 记录错误信息
     */
    error(message: string, error?: Error): void;
    /**
     * 检查是否应该记录给定级别的日志
     */
    private shouldLog;
    /**
     * 记录日志的内部方法
     */
    private log;
}

/**
 * LLM 消息接口
 */
interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
/**
 * LLM 请求参数
 */
interface LLMRequest {
    messages: LLMMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}
/**
 * LLM 响应接口
 */
interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
}
/**
 * 重试配置
 */
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
}
/**
 * 基础 LLM 组件类
 */
declare abstract class BaseLLM extends BaseComponent {
    protected retryConfig: RetryConfig;
    protected defaultModel: string;
    constructor(name: string, defaultModel?: string);
    /**
     * 设置重试配置
     */
    setRetryConfig(config: Partial<RetryConfig>): void;
    /**
     * 抽象方法：发送请求到 LLM 服务
     */
    protected abstract sendRequest(request: LLMRequest): Promise<LLMResponse>;
    /**
     * 公共方法：带重试机制的聊天
     */
    chat(request: LLMRequest): Promise<LLMResponse>;
    /**
     * 便捷方法：发送单条消息
     */
    sendMessage(content: string, role?: 'user' | 'system', options?: Partial<LLMRequest>): Promise<string>;
    /**
     * 便捷方法：多轮对话
     */
    conversation(messages: LLMMessage[], options?: Partial<LLMRequest>): Promise<string>;
    /**
     * 重试机制实现
     */
    protected withRetry<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * 判断是否应该重试
     */
    protected shouldRetry(error: Error): boolean;
    /**
     * 计算延迟时间（指数退避）
     */
    protected calculateDelay(attempt: number): number;
    /**
     * 睡眠函数
     */
    protected sleep(ms: number): Promise<void>;
    /**
     * 验证请求参数
     */
    protected validateRequest(request: LLMRequest): void;
}

/**
 * 阿里云百练配置接口
 */
interface QwenConfig {
    apiKey: string;
    baseURL?: string;
}
/**
 * 阿里云百练 Qwen LLM 实现
 * 基于 OpenAI 兼容的 API 接口
 */
declare class QwenLLM extends BaseLLM {
    private client;
    private config;
    constructor(config: QwenConfig, defaultModel?: string);
    /**
     * 初始化组件
     */
    init(): Promise<void>;
    /**
     * 判断是否为 Qwen3 模型
     * 根据官方文档，现在大部分模型都基于 Qwen3
     */
    private isQwen3Model;
    /**
     * 获取 Qwen3 模型的 enable_thinking 默认值
     * 根据千问官方文档：
     * - Qwen3 商业版模型默认值为 False
     * - Qwen3 开源版模型默认值为 True
     * - 但某些场景下需要显式设置为 false
     */
    private getEnableThinkingValue;
    /**
     * 发送请求到阿里云百练
     */
    protected sendRequest(request: LLMRequest): Promise<LLMResponse>;
    /**
     * 测试 API 连接
     */
    private testConnection;
    /**
     * 流式聊天（阿里云百练支持）
     */
    streamChat(request: LLMRequest, onChunk: (chunk: string) => void): Promise<LLMResponse>;
    /**
     * 获取可用模型列表
     */
    getModels(): Promise<string[]>;
    /**
     * 设置系统提示词
     */
    chatWithSystem(systemPrompt: string, userMessage: string, options?: Partial<LLMRequest>): Promise<string>;
    /**
     * 函数调用（Qwen 支持函数调用）
     */
    functionCall(messages: any[], functions: any[], options?: Partial<LLMRequest>): Promise<any>;
    /**
     * 带 thinking 模式控制的聊天（仅适用于 Qwen3 模型）
     */
    chatWithThinking(request: LLMRequest, enableThinking?: boolean): Promise<LLMResponse>;
}

/**
 * 火山方舟配置接口
 */
interface VolcEngineConfig {
    apiKey: string;
    baseURL?: string;
    endpointId?: string;
}
/**
 * 火山方舟 LLM 实现
 * 基于 OpenAI 兼容的 API 接口
 */
declare class VolcEngineLLM extends BaseLLM {
    private client;
    private config;
    constructor(config: VolcEngineConfig, defaultModel?: string);
    /**
     * 初始化组件
     */
    init(): Promise<void>;
    /**
     * 发送请求到火山方舟
     */
    protected sendRequest(request: LLMRequest): Promise<LLMResponse>;
    /**
     * 测试 API 连接
     */
    private testConnection;
    /**
     * 流式聊天（火山方舟支持）
     */
    streamChat(request: LLMRequest, onChunk: (chunk: string) => void): Promise<LLMResponse>;
    /**
     * 获取可用模型列表
     */
    getModels(): Promise<string[]>;
}

/**
 * 默认配置模块
 * 管理 LLM 的默认配置参数
 */
interface LLMProviderConfig {
    apiKey: string;
    defaultModel: string;
    baseURL?: string;
}
interface DefaultConfig {
    llm: {
        qwen: LLMProviderConfig;
        volcengine: LLMProviderConfig;
    };
}
/**
 * 默认配置
 * 基于测试成功的配置设定
 */
declare const DEFAULT_CONFIG: DefaultConfig;
/**
 * 获取指定提供商的配置
 */
declare function getProviderConfig(provider: 'qwen' | 'volcengine'): LLMProviderConfig;
/**
 * 获取所有支持的提供商列表
 */
declare function getSupportedProviders(): string[];
/**
 * 检查提供商是否受支持
 */
declare function isProviderSupported(provider: string): provider is 'qwen' | 'volcengine';
/**
 * 从环境变量加载配置
 */
declare function loadConfigFromEnv(): Partial<DefaultConfig>;

export { Agent, type AgentOptions, BaseComponent, BaseLLM, type Component, DEFAULT_CONFIG, type DefaultConfig, type LLMMessage, type LLMProviderConfig, type LLMRequest, type LLMResponse, LoggerComponent, type QwenConfig, QwenLLM, type RetryConfig, type VolcEngineConfig, VolcEngineLLM, getProviderConfig, getSupportedProviders, isProviderSupported, loadConfigFromEnv };
