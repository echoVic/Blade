/**
 * LangChain 记忆类型定义
 */

/**
 * Blade Memory 类型定义
 * 定义记忆存储的核心接口和类型
 */

/**
 * 记忆条目
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
 * 记忆类型
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
 * 记忆配置
 */
export interface BladeMemoryConfig {
  provider: MemoryProvider;

  // 存储配置
  storage: {
    type: 'memory' | 'file' | 'redis' | 'database' | 'custom';
    config?: Record<string, any>;
  };

  // 容量限制
  limits: {
    maxEntries?: number;
    maxSizePerEntry?: number; // bytes
    maxTotalSize?: number; // bytes
    ttl?: number; // seconds，默认过期时间
  };

  // 清理策略
  cleanup: {
    strategy: 'lru' | 'lfu' | 'ttl' | 'importance' | 'custom';
    interval?: number; // seconds
    customFunction?: (entries: MemoryEntry[]) => MemoryEntry[];
  };

  // 压缩配置
  compression: {
    enabled: boolean;
    algorithm?: 'gzip' | 'brotli' | 'custom';
    threshold?: number; // bytes，超过阈值才压缩
  };

  // 加密配置
  encryption: {
    enabled: boolean;
    algorithm?: 'aes-256-gcm' | 'chacha20-poly1305';
    key?: string;
  };

  // 同步配置
  sync: {
    enabled: boolean;
    interval?: number;
    conflictResolution?: 'merge' | 'overwrite' | 'ignore';
  };
}

/**
 * 记忆提供者接口
 */
export interface MemoryProvider {
  // 基础操作
  get(sessionId: string, key?: string): Promise<MemoryEntry[]>;
  set(entry: MemoryEntry): Promise<void>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<void>;
  delete(id: string): Promise<void>;
  clear(sessionId: string): Promise<void>;

  // 查询操作
  search(query: MemorySearchQuery): Promise<MemoryEntry[]>;
  filter(criteria: MemoryFilterCriteria): Promise<MemoryEntry[]>;

  // 统计操作
  count(sessionId: string, type?: MemoryType): Promise<number>;
  size(sessionId: string): Promise<number>;

  // 维护操作
  cleanup(): Promise<number>; // 返回清理的条目数
  optimize(): Promise<void>;
  export(sessionId: string): Promise<MemoryExport>;
  import(data: MemoryExport): Promise<void>;
}

/**
 * 记忆搜索查询
 */
export interface MemorySearchQuery {
  sessionId: string;
  query: string;
  type?: MemoryType[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'createdAt' | 'importance' | 'access_count';
  sortOrder?: 'asc' | 'desc';
  timeRange?: {
    start?: Date;
    end?: Date;
  };
  includeExpired?: boolean;
}

/**
 * 记忆过滤条件
 */
export interface MemoryFilterCriteria {
  sessionId: string;
  userId?: string;
  type?: MemoryType[];
  tags?: string[];
  metadata?: Record<string, any>;
  importance?: {
    min?: number;
    max?: number;
  };
  createdAt?: {
    start?: Date;
    end?: Date;
  };
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 记忆导出格式
 */
export interface MemoryExport {
  version: string;
  exportedAt: Date;
  sessionId: string;
  entries: MemoryEntry[];
  metadata?: Record<string, any>;
}

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
 * 记忆管理器接口
 */
export interface MemoryManager {
  // 会话管理
  createSession(sessionId: string, userId?: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(userId?: string): Promise<string[]>;

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
  compress(sessionId: string): Promise<number>;
  merge(sourceSessionId: string, targetSessionId: string): Promise<void>;

  // 统计和监控
  getStats(sessionId: string): Promise<MemoryStats>;
  addEventListener(listener: MemoryEventListener): void;
  removeEventListener(listener: MemoryEventListener): void;
}

/**
 * 记忆中间件接口
 */
export interface MemoryMiddleware {
  name: string;
  priority: number;

  beforeCreate?(entry: MemoryEntry): Promise<MemoryEntry | null>;
  afterCreate?(entry: MemoryEntry): Promise<void>;

  beforeRead?(query: MemorySearchQuery): Promise<MemorySearchQuery>;
  afterRead?(entries: MemoryEntry[]): Promise<MemoryEntry[]>;

  beforeUpdate?(id: string, updates: Partial<MemoryEntry>): Promise<Partial<MemoryEntry>>;
  afterUpdate?(entry: MemoryEntry): Promise<void>;

  beforeDelete?(id: string): Promise<boolean>; // return false to prevent deletion
  afterDelete?(id: string): Promise<void>;
}

/**
 * 记忆策略配置
 */
export interface MemoryStrategy {
  // 存储策略
  storage: {
    importance_threshold: number; // 低于此重要性的记忆不存储
    deduplication: boolean; // 是否去重
    compression: boolean; // 是否压缩
  };

  // 检索策略
  retrieval: {
    max_results: number;
    relevance_threshold: number;
    time_decay_factor: number; // 时间衰减因子
    importance_boost: number; // 重要性加权
  };

  // 清理策略
  cleanup: {
    max_age_days: number;
    max_entries: number;
    importance_threshold: number;
  };
}

/**
 * 向量记忆配置（用于语义搜索）
 */
export interface VectorMemoryConfig {
  enabled: boolean;
  dimensions: number;
  similarity_threshold: number;
  index_type: 'flat' | 'hnsw' | 'ivf';
  distance_metric: 'cosine' | 'euclidean' | 'dot_product';
  embedding_model?: string;
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
