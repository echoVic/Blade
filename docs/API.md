# 📖 Blade API 参考

## 🎯 核心类

### `Agent` - 智能代理入口

```typescript
import { Agent } from 'blade-ai';

// 创建Agent实例
const agent = new Agent({
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.example.com',
  modelName: 'my-model'
});

// 基础聊天
const response = await agent.chat('你好');

// 系统提示词聊天
const response = await agent.chatWithSystem('你是代码助手', '写个排序');

// 多轮对话
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
  { role: 'user', content: '再问一个问题' }
];
const response = await agent.conversation(messages);

// 获取配置
const config = agent.getConfig();

// 更新配置
agent.updateConfig({ modelName: 'new-model' });
```

### `LLMManager` - LLM调用管理器

```typescript
import { LLMManager } from 'blade-ai';

// 创建LLM管理器
const llm = new LLMManager({
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.example.com',
  modelName: 'my-model'
});

// 基础调用
const response = await llm.send({
  messages: [{ role: 'user', content: '你好' }]
});

// 快速聊天
const response = await llm.chat('你好');

// 系统对话
const response = await llm.chatWithSystem('你是代码助手', '写个排序');

// 多轮对话
const response = await llm.conversation(messages);

// 更新配置
llm.configure({ modelName: 'new-model' });
```

## 🛠️ 配置管理

### `ConfigManager` - 配置管理器

```typescript
import { ConfigManager } from 'blade-ai';

// 创建配置管理器
const config = new ConfigManager();

// 获取完整配置
const settings = config.getConfig();

// 获取特定配置项
const apiKey = config.get('apiKey');

// 设置配置项
config.set('modelName', 'new-model');

// 更新配置
config.updateConfig({ baseUrl: 'https://new-api.com' });
```

## 📋 类型定义

### `BladeConfig` - 平铺配置接口

```typescript
interface BladeConfig {
  // 认证配置（必需）
  apiKey: string;
  baseUrl?: string;
  modelName?: string;
  searchApiKey?: string;

  // UI配置  
  theme?: 'GitHub' | 'dark' | 'light' | 'auto';
  hideTips?: boolean;
  hideBanner?: boolean;

  // 安全配置
  sandbox?: 'docker' | 'none';
  
  // 工具配置
  toolDiscoveryCommand?: string;
  toolCallCommand?: string;
  summarizeToolOutput?: Record<string, { tokenBudget?: number }>;

  // MCP配置
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;

  // 遥测配置
  telemetry?: {
    enabled?: boolean;
    target?: 'local' | 'remote';
    otlpEndpoint?: string;
    logPrompts?: boolean;
  };

  // 使用配置
  usageStatisticsEnabled?: boolean;
  maxSessionTurns?: number;

  // 调试配置
  debug?: boolean;
}
```

### `LLMMessage` - 消息接口

```typescript
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### `LLMRequest` - 请求接口

```typescript
interface LLMRequest {
  messages: LLMMessage[];
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}
```

### `LLMResponse` - 响应接口

```typescript
interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}
```

## 🔄 配置加载顺序

```javascript
// 1. 默认配置
const DEFAULT_CONFIG = {
  apiKey: '',
  baseUrl: 'https://apis.iflow.cn/v1',
  modelName: 'Qwen3-Coder',
  // ... 其他默认值
};

// 2. 用户配置 (~/.blade/config.json)
// 3. 项目配置 (./.blade.json 或 package.json#blade)
// 4. 环境变量 (BLADE_*)
// 5. CLI参数 (--api-key 等)
```