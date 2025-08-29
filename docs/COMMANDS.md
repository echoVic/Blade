# 📋 Blade 命令参考

## 🎯 核心命令

### `blade chat` - 智能对话
```bash
# 基础对话
blade chat "你好"

# 使用系统提示词
blade chat -s "你是一个代码助手" "写个Python排序"

# 交互式对话
blade chat -i

# 流式输出
blade chat --stream "详细解释AI原理"
```

**参数**:
- `-k, --api-key <key>` - API密钥
- `-u, --base-url <url>` - 基础URL
- `-m, --model <name>` - 模型名称
- `-s, --system <prompt>` - 系统提示词
- `-i, --interactive` - 交互式模式
- `--stream` - 流式输出

### `blade config` - 配置管理
```bash
# 查看配置
blade config show

# 设置配置项
blade config set apiKey "sk-xxx"

# 验证配置
blade config validate
```

## ⚙️ 配置方式

### 1. 环境变量
```bash
export BLADE_API_KEY="sk-xxx"
export BLADE_BASE_URL="https://api.example.com"
export BLADE_MODEL="my-model"
```

### 2. 配置文件
```json
// .blade.json
{
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.example.com",
  "modelName": "my-model"
}
```

### 3. CLI参数
```bash
blade chat -k "sk-xxx" -u "https://api.example.com" -m "my-model" "你好"
```

## 📊 配置优先级

```
CLI参数 > 环境变量 > 项目配置文件 > 用户配置文件 > 默认值
```

## 🚀 快速验证

```bash
# 检查版本
blade --version

# 显示帮助
blade --help

# 快速测试
blade chat "现在几点了？"
```