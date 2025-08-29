# 🗡️ Blade 文档

Blade是一款基于**平铺三要素配置**的AI命令行工具，支持任意开放AI协议的大模型。

## 📚 文档目录

- [快速开始](./QUICK_START.md) - 三步上手使用
- [配置系统](./CONFIGURATION.md) - 平铺配置详解
- [CLI命令](./COMMANDS.md) - 所有命令参考
- [API参考](./API.md) - 编程接口文档

## 🎯 核心特性

### ✨ 平铺三要素配置
- `apiKey`: API密钥（必需）
- `baseUrl`: 服务地址（默认：https://apis.iflow.cn/v1）
- `modelName`: 模型名称（默认：Qwen3-Coder）

### 🚀 极简调用
```bash
# 环境变量方式
export BLADE_API_KEY="sk-xxx"
blade chat "你好，世界！"

# 配置文件方式  
echo '{"apiKey":"sk-xxx"}' > .blade.json
blade chat "你好，世界！"
```

### 📦 开箱即用
- 支持任意开放AI协议模型
- 环境变量、配置文件、CLI参数三重配置
- 自动重试和流式输出
- 极简CLI接口设计

## 🛠️ 安装使用

```bash
# 全局安装
npm install -g blade-ai

# 或者免安装使用
npx blade-ai chat "你好"
```

## 🔧 支持功能

- 💬 智能问答对话
- 💻 代码生成辅助
- 📚 文本内容创作
- 🛠️ 实用工具集
- 🔄 流式实时输出
- 🎮 交互式对话

---
@2025 Blade AI