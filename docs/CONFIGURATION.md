# 🛠️ Blade 配置系统

Blade采用清晰的分层配置架构，将敏感信息和项目设置分离。

## 目录

- [📁 配置文件结构](#-配置文件结构)
- [🔧 配置方式](#-配置方式)
- [⚡ 配置优先级](#-配置优先级)
- [🎯 核心配置项](#-核心配置项)
- [📋 使用示例](#-使用示例)
- [🔍 配置管理命令](#-配置管理命令)
- [🛡️ 安全建议](#️-安全建议)
- [📂 目录结构最佳实践](#-目录结构最佳实践)
- [🎛️ 统一配置系统（开发指南）](#️-统一配置系统开发指南)

## 📁 配置文件结构

### 用户级别配置（敏感信息）
**位置**: `~/.blade/config.json`

包含API密钥等私密信息：
```json
{
  "apiKey": "sk-你的API密钥",
  "baseUrl": "https://api.example.com",
  "modelName": "kimi-k2"
}
```

### 项目级别配置（非敏感设置）
**位置**: `./.blade/settings.local.json`

包含项目特定设置：
```json
{
  "projectName": "Blade AI Project",
  "version": "1.0.0",
  "features": {
    "enableTools": true,
    "enableMCP": false,
    "enableContext": true
  },
  "ui": {
    "theme": "dark",
    "compactOutput": false
  },
  "security": {
    "sandboxEnabled": true,
    "maxFileSize": 10485760
  }
}
```

## 🔧 配置方式

### 1. 环境变量（最高优先级）
```bash
export BLADE_API_KEY="sk-xxx"
export BLADE_BASE_URL="https://api.example.com"
export BLADE_MODEL="my-model"
```

### 2. 用户配置文件
```bash
# 创建用户配置
mkdir -p ~/.blade
echo '{"apiKey":"sk-xxx"}' > ~/.blade/config.json
```

### 3. 项目配置文件
```bash
# 创建项目配置目录
mkdir -p .blade

# 创建项目设置
echo '{
  "features": {"enableTools": true},
  "ui": {"theme": "dark"}
}' > .blade/settings.local.json
```

### 4. CLI命令行参数
```bash
blade chat -k "sk-xxx" -u "https://api.example.com" -m "my-model" "你好"
```

## ⚡ 配置优先级

```
CLI参数 > 环境变量 > 用户配置文件 > 项目配置文件 > 默认值
```

## 🎯 核心配置项

### 敏感配置（仅用户配置文件）
- `apiKey`: API密钥
- `baseUrl`: API基础URL
- `modelName`: 模型名称

### 项目配置（项目设置文件）
- `features.*`: 功能开关
- `ui.*`: 界面设置
- `security.*`: 安全配置

## 📋 使用示例

### 快速开始
```bash
# 1. 设置API密钥
echo '{"apiKey":"sk-你的密钥"}' > ~/.blade/config.json

# 2. 开始使用
blade chat "你好世界"
```

### 团队协作
```bash
# 项目设置（可版本控制）
echo '{"features":{"enableTools":true}}' > .blade/settings.local.json

# 个人API密钥（不应提交）
echo '{"apiKey":"sk-你的密钥"}' > ~/.blade/config.json
```

## 🔍 配置管理命令

```bash
# 查看当前配置
blade config show

# 验证配置
blade config validate

# 重置配置
blade config reset
```

## 🛡️ 安全建议

1. **用户配置文件** (`~/.blade/config.json`) 包含敏感信息，不应提交到版本控制
2. **项目配置文件** (`./.blade/settings.local.json`) 可以团队共享
3. 使用环境变量在CI/CD环境中注入敏感配置
4. 定期轮换API密钥

## 📂 目录结构最佳实践

```
项目根目录/
├── .blade/
│   └── settings.local.json  # 项目设置（可共享）
├── src/
└── package.json

用户主目录/
└── .blade/
    └── config.json          # 用户API配置（私有）
```

这样设计确保了敏感信息安全，同时项目设置可以方便地团队协作。

## 🎛️ 统一配置系统（开发指南）

### 系统架构

Blade 2.0 引入了全新的分层配置系统，支持以下特性：

- **分层配置**：全局默认 → 项目配置 → 用户配置 → 环境变量（优先级从低到高）
- **类型安全**：使用 Zod 进行严格的配置验证
- **实时热重载**：配置文件变更时自动重载
- **事件驱动**：配置变更时的通知机制
- **向后兼容**：保持原有 API 接口不变

### 配置结构

新的配置系统将配置分为以下模块：

```typescript
interface BladeUnifiedConfig {
  auth: AuthConfig;        // 认证配置
  ui: UIConfig;            // UI 配置
  security: SecurityConfig; // 安全配置
  tools: ToolsConfig;      // 工具配置
  mcp: MCPConfig;          // MCP 配置
  telemetry: TelemetryConfig; // 遥测配置
  usage: UsageConfig;      // 使用配置
  debug: DebugConfig;      // 调试配置
  extensions: ExtensionsConfig; // 扩展配置
}
```

### 开发者 API

#### ConfigurationManager 类

```typescript
import { ConfigurationManager } from '@blade-ai/core';

// 创建配置管理器实例
const configManager = new ConfigurationManager();

// 初始化配置
await configManager.initialize();

// 获取当前配置
const config = configManager.getConfig();

// 更新配置
await configManager.updateConfig({
  ui: {
    theme: 'dark'
  }
});

// 重新加载配置
await configManager.reload();
```

#### React Hooks

```typescript
import { useConfig, useConfigValue } from '@blade-ai/ui';

function MyComponent() {
  const { config, updateConfig } = useConfig();
  
  const { value: theme, setValue: setTheme } = useConfigValue('ui.theme');

  return (
    <div>
      <h1>当前主题: {theme}</h1>
      <button onClick={() => setTheme('dark')}>
        切换为暗色主题
      </button>
    </div>
  );
}
```

#### 配置验证

```typescript
import { BladeUnifiedConfigSchema } from '@blade-ai/core';

try {
  const validatedConfig = BladeUnifiedConfigSchema.parse(config);
  console.log('配置验证通过');
} catch (error) {
  console.error('配置验证失败:', error);
}
```

### 配置迁移

从旧版本配置迁移到新版本：

```bash
# 检查配置状态
npx blade-config-migrate check

# 执行配置迁移
npx blade-config-migrate migrate

# 交互式迁移向导
npx blade-config-migrate interactive
```

新的配置系统为 Blade 提供了更强大、更灵活的配置管理能力，同时保持了与旧版本的完全兼容性。