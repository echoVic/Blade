// MCP相关类型定义

export interface McpServer {
  id: string;
  name: string;
  endpoint: string;
  transport: 'stdio' | 'sse' | 'websocket';
  enabled: boolean;
  config: Record<string, any>;
  capabilities: string[];
  autoConnect: boolean;
}

export interface McpConfig {
  enabled: boolean;
  servers: McpServer[];
  autoConnect: boolean;
  timeout: number;
  maxConnections: number;
  defaultTransport: 'stdio' | 'sse' | 'websocket';
  security: {
    validateCertificates: boolean;
    allowedOrigins: string[];
    maxMessageSize: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    filePath: string;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface McpConnection {
  serverId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: number;
  disconnectedAt?: number;
  error?: string;
  capabilities: string[];
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: string[];
}

export interface McpMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image?: string }>;
  timestamp?: string;
}

export interface McpResponse {
  content: string;
  role: 'assistant';
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
}

export interface McpError {
  code: number;
  message: string;
  data?: any;
}

export interface McpProgress {
  total?: number;
  completed: number;
  message?: string;
}

export interface McpNotification {
  method: string;
  params?: any;
}

export interface McpRequest {
  method: string;
  params?: any;
  id: string;
}

export interface McpServerInfo {
  name: string;
  version: string;
  capabilities: string[];
  extensions: string[];
}

export interface McpAuthentication {
  type: 'oauth2' | 'apikey' | 'bearer' | 'custom';
  token?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
}

export interface McpServerStatus {
  id: string;
  name: string;
  endpoint: string;
  status: 'online' | 'offline' | 'connecting' | 'error';
  lastChecked: number;
  responseTime?: number;
  error?: string;
}

export interface McpServerGroup {
  id: string;
  name: string;
  description?: string;
  servers: string[]; // server IDs
  priority: number;
}

export interface McpServerDiscovery {
  id: string;
  name: string;
  endpoint: string;
  transport: 'stdio' | 'sse' | 'websocket';
  description?: string;
  tags?: string[];
  version?: string;
  protocols?: string[];
}

export interface McpServerTemplate {
  id: string;
  name: string;
  description: string;
  endpointTemplate: string;
  defaultTransport: 'stdio' | 'sse' | 'websocket';
  requiredConfig: string[];
  optionalConfig: string[];
  capabilities: string[];
}

export interface McpServiceDiscovery {
  services: Array<{
    name: string;
    endpoint: string;
    protocol: string;
    version: string;
    metadata: Record<string, any>;
  }>;
}

export interface McpServiceRegistration {
  name: string;
  endpoint: string;
  protocol: string;
  version: string;
  capabilities: string[];
  metadata: Record<string, any>;
}

export interface McpServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    details?: any;
  }>;
  timestamp: number;
}

export interface McpTelemetry {
  requestId: string;
  serverId: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'error';
  error?: string;
  bytesSent: number;
  bytesReceived: number;
  retries: number;
}

export interface McpCacheEntry {
  key: string;
  value: any;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface McpCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  averageLoadTime: number;
}

export interface McpRateLimit {
  serverId: string;
  requests: number;
  limit: number;
  window: number; // milliseconds
  resetTime: number;
}

export interface McpServerMetrics {
  serverId: string;
  connections: number;
  requests: number;
  errors: number;
  avgResponseTime: number;
  uptime: number;
  lastActivity: number;
}

export interface McpClientMetrics {
  totalConnections: number;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  avgRequestTime: number;
  cacheHitRate: number;
}