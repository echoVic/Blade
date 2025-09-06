/**
 * LLM系统类型定义
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: {
    timestamp?: number;
    importance?: number;
    compressed?: boolean;
    [key: string]: any;
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  metadata?: {
    executionTime?: number;
    modelSelected?: string;
    compressionApplied?: boolean;
    [key: string]: any;
  };
}

export interface StreamLLMResponse {
  content: string;
  done: boolean;
  delta?: string;
  metadata?: Record<string, any>;
}

export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
}

export interface LLMProvider {
  name: string;
  baseUrl: string;
  models: string[];
  supportedFeatures: string[];
  authentication: {
    type: 'bearer' | 'api_key' | 'oauth';
    headerName?: string;
  };
}

export interface LLMCapability {
  name: string;
  description: string;
  supportedModels: string[];
  requiredFeatures: string[];
}
