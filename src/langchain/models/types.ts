/**
 * LangChain 模型类型定义
 */

/**
 * 千问模型配置
 */
export interface QwenModelConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  maxRetries?: number;
  timeout?: number;
}

/**
 * 火山引擎模型配置
 */
export interface VolcEngineModelConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  maxRetries?: number;
  timeout?: number;
}

/**
 * 通用模型配置
 */
export interface BladeModelConfig {
  provider: 'qwen' | 'volcengine';
  config: QwenModelConfig | VolcEngineModelConfig;
  debug?: boolean;
}
