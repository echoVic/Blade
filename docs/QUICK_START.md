# 🚀 Blade 快速开始指南

## 🎯 三步开始使用

### 步骤1：设置配置（任选其一）

#### 方式A：环境变量（推荐）
```bash
export BLADE_API_KEY="sk-你的API密钥"
export BLADE_BASE_URL="https://apis.iflow.cn/v1"
export BLADE_MODEL="Qwen3-Coder"
```

#### 方式B：配置文件
```bash
echo '{
  "apiKey": "sk-你的API密钥"
}' > .blade.json
```

#### 方式C：命令行参数
```bash
blade chat -k "sk-你的API密钥" "你好"
```

### 步骤2：开始对话

```bash
# 单次问答
blade chat "你好，世界！"

# 交互式对话
blade chat -i

# 系统提示词
blade chat -s "你是一个代码助手" "帮我写一个Python冒泡排序"
```

### 步骤3：享受AI能力

- 💬 智能问答对话
- 💻 代码生成辅助  
- 📚 文本内容创作
- 🛠️ 各种实用工具

## 📋 常用命令示例

```bash
# 基础使用
blade chat "什么是人工智能？"
blade chat "用Python写一个快速排序"

# 交互模式
blade chat -i

# 查看配置
blade config show

# 设置配置
blade config set apiKey "sk-xxx"
```

## 🛠️ 核心配置三要素

1. **apiKey** - API密钥（必需）
2. **baseUrl** - 服务地址（默认：https://apis.iflow.cn/v1）
3. **modelName** - 模型名称（默认：Qwen3-Coder）

## ✅ 验证安装

```bash
# 检查版本
blade --version

# 显示帮助
blade --help

# 快速测试
blade chat "请告诉我现在几点了？"
```

现在你已经准备好使用 Blade 了！