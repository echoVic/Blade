/**
 * Blade Chains 类型定义
 * 定义链式处理的核心接口和类型
 */

import { BladeMemory } from '../memory/BladeMemory.js';
import { BladeTool } from '../tools/base/BladeTool.js';

/**
 * 链执行上下文
 */
export interface ChainContext {
  executionId: string;
  sessionId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  variables?: Record<string, any>;
}

/**
 * 链步骤定义
 */
export interface ChainStep {
  id: string;
  name: string;
  description?: string;
  type: 'tool' | 'prompt' | 'condition' | 'transform' | 'parallel' | 'sequence';
  config: ChainStepConfig;
  dependencies?: string[];
  optional?: boolean;
  retryCount?: number;
  timeout?: number;
}

/**
 * 链步骤配置
 */
export type ChainStepConfig =
  | ToolStepConfig
  | PromptStepConfig
  | ConditionStepConfig
  | TransformStepConfig
  | ParallelStepConfig
  | SequenceStepConfig;

/**
 * 工具步骤配置
 */
export interface ToolStepConfig {
  toolName: string;
  parameters: Record<string, any>;
  outputMapping?: Record<string, string>;
  errorHandling?: ErrorHandling;
}

/**
 * 提示步骤配置
 */
export interface PromptStepConfig {
  template: string;
  variables?: Record<string, any>;
  model?: string;
  modelConfig?: Record<string, any>;
  outputParser?: string;
}

/**
 * 条件步骤配置
 */
export interface ConditionStepConfig {
  condition: string; // JavaScript 表达式
  trueStep: string;
  falseStep?: string;
  variables?: Record<string, any>;
}

/**
 * 转换步骤配置
 */
export interface TransformStepConfig {
  transformer: string; // JavaScript 函数
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

/**
 * 并行步骤配置
 */
export interface ParallelStepConfig {
  steps: string[];
  mergeStrategy: 'merge' | 'array' | 'first' | 'custom';
  mergeFunction?: string;
  failureStrategy: 'fail' | 'continue' | 'partial';
}

/**
 * 序列步骤配置
 */
export interface SequenceStepConfig {
  steps: string[];
  passthrough?: boolean;
  earlyExit?: boolean;
}

/**
 * 错误处理配置
 */
export interface ErrorHandling {
  strategy: 'fail' | 'retry' | 'skip' | 'fallback';
  maxRetries?: number;
  fallbackStep?: string;
  fallbackValue?: any;
}

/**
 * 链定义
 */
export interface ChainDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: string;
  tags?: string[];

  steps: ChainStep[];
  entryPoint: string;

  memory?: {
    enabled: boolean;
    type: string;
    config?: Record<string, any>;
  };

  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * 链执行结果
 */
export interface ChainExecutionResult {
  success: boolean;
  chainId: string;
  executionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;

  steps: StepExecutionResult[];
  finalOutput?: any;
  error?: string;

  metadata?: Record<string, any>;
  memoryUpdates?: any[];
}

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;

  input?: any;
  output?: any;
  error?: string;

  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * 链配置
 */
export interface ChainConfig {
  maxExecutionTime?: number;
  maxSteps?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  errorStrategy?: 'fail-fast' | 'continue' | 'rollback';

  memory?: {
    provider: BladeMemory;
    sessionKey?: string;
  };

  tools?: Map<string, BladeTool>;
  variables?: Record<string, any>;
}

/**
 * 链执行状态
 */
export enum ChainExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * 链执行事件
 */
export interface ChainExecutionEvent {
  type: 'chain-start' | 'chain-end' | 'step-start' | 'step-end' | 'error' | 'retry';
  chainId: string;
  executionId: string;
  stepId?: string;
  timestamp: Date;
  data?: any;
}

/**
 * 链执行监听器
 */
export type ChainExecutionListener = (event: ChainExecutionEvent) => void | Promise<void>;

/**
 * 链验证结果
 */
export interface ChainValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 链构建器接口
 */
export interface ChainBuilder {
  step(config: ChainStep): ChainBuilder;
  tool(name: string, config: ToolStepConfig): ChainBuilder;
  prompt(template: string, config?: Partial<PromptStepConfig>): ChainBuilder;
  condition(condition: string, trueStep: string, falseStep?: string): ChainBuilder;
  transform(transformer: string): ChainBuilder;
  parallel(steps: string[], config?: Partial<ParallelStepConfig>): ChainBuilder;
  sequence(steps: string[], config?: Partial<SequenceStepConfig>): ChainBuilder;
  memory(config: any): ChainBuilder;
  build(): ChainDefinition;
}

/**
 * 链注册表接口
 */
export interface ChainRegistry {
  register(definition: ChainDefinition): Promise<void>;
  unregister(chainId: string): Promise<void>;
  get(chainId: string): Promise<ChainDefinition | null>;
  list(tags?: string[]): Promise<ChainDefinition[]>;
  search(query: string): Promise<ChainDefinition[]>;
}

/**
 * 链执行器接口
 */
export interface ChainExecutor {
  execute(
    chainId: string,
    input: any,
    context: ChainContext,
    config?: Partial<ChainConfig>
  ): Promise<ChainExecutionResult>;

  cancel(executionId: string): Promise<void>;
  getStatus(executionId: string): Promise<ChainExecutionStatus>;
  getResult(executionId: string): Promise<ChainExecutionResult | null>;

  addEventListener(listener: ChainExecutionListener): void;
  removeEventListener(listener: ChainExecutionListener): void;
}
