/**
 * LangChain Memory 相关类型定义
 * 只保留业务必需的类型，其他依赖 LangChain 原生类型
 */

/**
 * 记忆类型枚举
 */
export enum MemoryType {
  CONVERSATION = 'conversation',
  FACT = 'fact',
  PREFERENCE = 'preference',
  CONTEXT = 'context',
  TOOL_RESULT = 'tool_result',
  CHAIN_STATE = 'chain_state',
  USER_PROFILE = 'user_profile',
  SYSTEM_STATE = 'system_state',
  CUSTOM = 'custom',
}

/**
 * 记忆条目基础结构
 */
export interface MemoryEntry {
  id: string;
  sessionId: string;
  userId?: string;
  type: MemoryType;
  content: any;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  importance?: number; // 0-1，重要性评分
  access_count?: number;
  lastAccessedAt?: Date;
}

/**
 * 会话记忆条目
 */
export interface ConversationMemoryEntry extends MemoryEntry {
  type: MemoryType.CONVERSATION;
  content: {
    role: 'user' | 'assistant' | 'system';
    message: string;
    timestamp: Date;
    messageId?: string;
    parentMessageId?: string;
    model?: string;
    tokens?: number;
  };
}

/**
 * 事实记忆条目
 */
export interface FactMemoryEntry extends MemoryEntry {
  type: MemoryType.FACT;
  content: {
    fact: string;
    source?: string;
    confidence?: number; // 0-1
    category?: string;
    tags?: string[];
    verified?: boolean;
  };
}

/**
 * 偏好记忆条目
 */
export interface PreferenceMemoryEntry extends MemoryEntry {
  type: MemoryType.PREFERENCE;
  content: {
    key: string;
    value: any;
    category?: string;
    strength?: number; // 0-1，偏好强度
    source?: 'explicit' | 'inferred' | 'default';
  };
}

/**
 * 记忆事件
 */
export interface MemoryEvent {
  type: 'create' | 'update' | 'delete' | 'access' | 'cleanup' | 'error';
  sessionId: string;
  entryId?: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

/**
 * 记忆事件监听器
 */
export type MemoryEventListener = (event: MemoryEvent) => void | Promise<void>;

/**
 * 记忆统计信息
 */
export interface MemoryStats {
  sessionId: string;
  totalEntries: number;
  totalSize: number; // bytes
  entriesByType: Record<MemoryType, number>;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageImportance?: number;
  compressionRatio?: number;
}

/**
 * 简化的记忆管理器接口
 * 专注于核心功能，其他交给 LangChain
 */
export interface MemoryManager {
  // 会话管理
  createSession(sessionId: string, userId?: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;

  // 记忆操作
  remember(
    sessionId: string,
    type: MemoryType,
    content: any,
    metadata?: Record<string, any>
  ): Promise<string>;
  recall(sessionId: string, query?: string, type?: MemoryType): Promise<MemoryEntry[]>;
  forget(sessionId: string, entryId: string): Promise<void>;
  update(sessionId: string, entryId: string, updates: Partial<MemoryEntry>): Promise<void>;

  // 高级功能
  summarize(sessionId: string, maxEntries?: number): Promise<string>;
  compress(): Promise<number>;
  merge(sourceSessionId: string, targetSessionId: string): Promise<void>;

  // 统计和监控
  getStats(sessionId: string): Promise<MemoryStats>;
  addEventListener(listener: MemoryEventListener): void;
  removeEventListener(listener: MemoryEventListener): void;

  // LangChain 集成方法
  getMemoryInstance(sessionId: string): Promise<any>; // BaseMemory
  getMemoryVariables(sessionId: string, inputs?: Record<string, any>): Promise<Record<string, any>>;
  saveContext(
    sessionId: string,
    inputs: Record<string, any>,
    outputs: Record<string, any>
  ): Promise<void>;
}

/**
 * 记忆压缩结果
 */
export interface MemoryCompressionResult {
  originalCount: number;
  compressedCount: number;
  savedBytes: number;
  compressionRatio: number;
  summary?: string;
}
