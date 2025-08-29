# 🛠️ Blade 配置系统

Blade采用清晰的分层配置架构，将敏感信息和项目设置分离。

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