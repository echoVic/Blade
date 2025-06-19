# 🗡️ Blade

基于 **LangChain** 的智能 CLI Agent 工具，提供便捷的命令行 AI 交互体验和强大的工具生态。

> 🚀 **v2.0 重大更新**: 完全重构至 LangChain 原生实现，性能和稳定性大幅提升！

[![npm version](https://badge.fury.io/js/blade-ai.svg)](https://www.npmjs.com/package/blade-ai)
[![Node.js Version](https://img.shields.io/node/v/blade-ai.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 核心特性

### 🔥 LangChain 原生支持
- ⚡ **原生 Agent**: 基于 LangChain 的 ReAct Agent 实现
- 🛡️ **企业级稳定**: 使用成熟的 LangChain 框架
- 🧩 **生态兼容**: 无缝集成 LangChain 生态系统
- 🔧 **标准化工具**: 完全兼容 LangChain Tools 接口

### 🤖 智能交互
- 🎯 **智能对话**：支持多种聊天模式，自动选择合适工具协助回答
- 🧠 **上下文记忆**：AI 记住对话历史，支持多会话管理
- 🔧 **25+ 工具**：涵盖 Git、文件、网络、智能分析等场景
- 🤖 **智能工具**：LLM 驱动的代码审查、文档生成、智能提交
- 🔗 **MCP 支持**：支持 Model Context Protocol，可扩展外部资源和工具
- 🛡️ **安全确认**：统一的命令确认机制，智能风险评估
- 🌟 **多模型支持**：千问(Qwen)、豆包(VolcEngine)
- �� **开箱即用**：零配置快速开始

### 🎯 通义千问 ReAct 支持 (NEW!)
- 🇨🇳 **中文 ReAct**: 专门适配通义千问的中文关键字解析器
- 🔄 **完整推理链**: 支持"思考-动作-观察"完整 ReAct 循环
- 🛠️ **智能工具调用**: 自动识别工具需求并精确执行
- 📝 **格式容错**: 智能解析各种输出格式，自动纠错重试
- ⚡ **流式推理**: 实时展示 Agent 思考和执行过程

**解决了什么问题？**
- ❌ 通义千问原生不支持 LangChain ReAct 格式
- ✅ 自定义解析器完美适配中文关键字
- ✅ 支持中英文混合格式：`思考:`、`Thought:`、`动作:`、`Action:` 等
- ✅ 错误处理和自动重试机制

## 🚀 快速开始

### ⚡ 零安装试用

```bash
# 无需安装，直接试用
npx blade-ai chat "你好，介绍一下自己"

# 智能工具调用
npx blade-ai chat "现在几点了？"

# 流式输出
npx blade-ai chat --stream "详细解释机器学习原理"
```

### 📦 安装

```bash
# 全局安装（推荐）
npm install -g blade-ai

# 然后就可以使用了
blade chat "你好"
```

### 🔐 配置 API 密钥

**选择一种方式配置 API 密钥：**

```bash
# 方式1: 环境变量（推荐）
export QWEN_API_KEY="your-qwen-api-key"

# 方式2: 命令行参数
blade chat --api-key your-api-key "你好"

# 方式3: .env 文件
cp config.env.example .env
# 编辑 .env 文件填入密钥
```

**获取 API 密钥：**
- 千问: https://dashscope.console.aliyun.com/apiKey
- 火山引擎: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey

## 🔄 v2.0 迁移指南

**从 v1.x 升级？** 查看 [LangChain 迁移指南](./LANGCHAIN_MIGRATION_GUIDE.md) 了解详细的升级说明。

### 主要变更
- ✅ Agent 系统完全基于 LangChain 实现
- ✅ 提升了性能和稳定性
- ⚠️ API 有破坏性变更（提供迁移指南）
- 🆕 新增 LangChain 生态系统兼容性

## 💬 基础使用

### 直接问答

```bash
# 基础聊天
blade chat "什么是人工智能？"

# 代码生成
blade chat "用Python写一个快速排序"

# 智能工具调用（自动识别需求）
blade chat "现在几点了？"
blade chat "查看当前git状态"
blade chat "帮我审查代码质量"
```

### 交互式聊天

```bash
# 启动持续对话
blade chat -i

# 流式输出交互
blade chat -i --stream

# 带记忆的对话
blade chat -i --context

# 使用 MCP 外部资源
blade chat --mcp my-server "分析项目数据"
```

### 上下文记忆

```bash
# 创建记忆会话
blade chat --context "我叫张三，是前端工程师"

# 在同一会话中继续
blade chat --context "你还记得我的职业吗？"

# 指定会话ID
blade chat --context --context-session "work" "今天学了React"
blade chat --context --context-session "work" "昨天我们聊了什么？"
```

## 🔧 工具生态

Blade 内置 25+ 实用工具，通过自然语言即可调用：

### 🤖 智能工具

| 工具 | 功能 | 使用示例 |
|------|------|----------|
| 智能代码审查 | LLM 分析代码质量、安全性 | `"审查我的 app.js 代码"` |
| 智能文档生成 | 基于代码生成 API 文档 | `"为项目生成 README"` |
| Git 智能提交 | 分析变更生成提交信息 | `"智能分析并提交代码"` |

### 📂 文件与 Git

| 类别 | 工具数 | 主要功能 |
|------|--------|----------|
| 文件系统 | 4个 | 读写文件、目录操作 |
| Git 工具 | 7个 | 状态查看、提交、分支管理 |
| 文本处理 | 4个 | 搜索、替换、格式化 |
| 网络工具 | 4个 | HTTP 请求、URL 处理 |
| 实用工具 | 6个 | 时间戳、UUID、Base64 等 |

### 🛡️ 安全确认机制

所有写入操作都提供智能确认：

```bash
blade chat "删除临时文件"
# 📋 建议执行以下命令:
#   rm temp.txt
#   风险级别: 中等
# ✔ 是否执行？ Yes
```

**风险级别：**
- 🟢 **安全** - 只读操作，自动执行
- 🟡 **中等** - 普通写入，需要确认
- 🟠 **高风险** - 覆盖文件，重点确认
- 🔴 **极高风险** - 危险操作，严格确认

## 🎭 使用场景

### 智能助手（默认）

```bash
blade chat "解释微服务架构"
blade chat "审查我的代码并优化"
blade chat "生成项目文档"
```

**特点：** 通用问答、代码生成、智能工具调用

### 客服助手

```bash
blade chat --scenario customer "我想要退货"
blade chat --scenario customer "产品有质量问题"
```

**特点：** 专业客服回复、情绪分析、标准化用语

### 代码助手

```bash
blade chat --scenario code "优化这个算法"
blade chat --scenario code "审查安全性问题"
blade chat --scenario code "生成单元测试"
```

**特点：** 代码分析、性能优化、Git 操作、文档生成

## 🌟 高级功能

### 工具管理

```bash
# 查看所有工具
blade tools list

# 按类别查看
blade tools list --category git

# 查看工具详情
blade tools info smart_code_review

# 直接调用工具
blade tools call uuid
```

### 模型切换

```bash
# 使用不同模型
blade chat --provider volcengine "你好"
blade chat --model qwen-max-latest "复杂问题"

# 查看可用模型
blade models --provider qwen
```

### 流式输出

```bash
# 实时显示回答
blade chat --stream "详细解释区块链技术"

# 交互式流式聊天
blade chat -i --stream
```

## 📋 命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `chat [question]` | 智能对话 | `blade chat "你好"` |
| `chat -i` | 交互式聊天 | `blade chat -i --stream` |
| `tools list` | 查看工具 | `blade tools list --category git` |
| `tools call <tool>` | 调用工具 | `blade tools call uuid` |
| `models` | 查看模型 | `blade models --provider qwen` |

### 常用参数

- `-i, --interactive` - 交互式模式
- `--stream` - 流式输出
- `--context` - 启用记忆
- `--scenario <type>` - 场景模式 (assistant/customer/code)
- `--provider <name>` - 指定提供商 (qwen/volcengine)
- `--api-key <key>` - 指定 API 密钥

## 💻 编程接口

### Agent 使用

```typescript
import { Agent } from 'blade-ai';

const agent = new Agent({
  llm: { provider: 'qwen', apiKey: 'your-key' },
  tools: { enabled: true }
});

await agent.init();

// 智能对话
const response = await agent.smartChat('审查代码');

// 调用工具
const result = await agent.callTool('uuid');

await agent.destroy();
```

### 工具管理

```typescript
import { createToolManager } from 'blade-ai';

const toolManager = await createToolManager();
const result = await toolManager.callTool({
  toolName: 'smart_code_review',
  parameters: { path: 'app.js' }
});
```

## 🔧 开发

### 项目结构

```
src/
├── agent/           # Agent 核心
├── llm/            # LLM 实现
├── tools/          # 工具系统
├── commands/       # CLI 命令
└── config/         # 配置管理
```

### 开发命令

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npm run type-check

# 代码格式化
npm run format
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 打开 Pull Request

## 📄 许可证

MIT License

---

## 💡 使用技巧

### 选择合适的模式

- **快速问答**: `blade chat "问题"` - 一次性问题
- **持续对话**: `blade chat -i` - 复杂任务讨论
- **流式输出**: `添加 --stream` - 更好的交互体验
- **记忆对话**: `添加 --context` - AI 记住历史

### 智能工具最佳实践

- 用自然语言描述需求，让 AI 自动选择工具
- 说"请审查代码"而不是记忆具体工具名
- 让 AI 分析 Git 变更，生成更好的提交信息
- 使用场景模式获得专业的回复风格

### 常见问题

**Q: API 密钥错误？**
```bash
# 检查配置
echo $QWEN_API_KEY

# 或直接指定
blade chat --api-key your-key "测试"
```

**Q: 如何更换模型？**
```bash
blade chat --provider volcengine "你好"
blade chat --model qwen-max-latest "复杂问题"
```

**Q: 工具调用失败？**
- 确保在正确的目录（Git 工具需要 Git 仓库）
- 检查文件权限（文件工具需要读写权限）
- 使用 `blade tools list` 查看可用工具

---

**🗡️ Blade - 让 AI 成为你的命令行伙伴！**
