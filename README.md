# 🗡️ Blade

一个专注于 LLM 的智能 CLI Agent 工具，提供便捷的命令行 AI 交互体验和强大的工具生态。

## ✨ 特性

- 🎯 **专注 LLM**：纯粹的 LLM CLI Agent，无其他干扰功能
- 💬 **多种聊天模式**：直接问答、交互式聊天、场景演示
- 🎭 **智能场景**：智能助手、客服、代码助手等专业场景
- 🔄 **流式聊天**：支持实时流式输出
- 🌟 **多提供商**：支持千问(Qwen)和豆包(VolcEngine)
- 🔧 **工具生态**：内置27个实用工具，涵盖Git、文件、网络、智能分析、命令确认等
- 🤖 **智能工具**：基于LLM增强的智能代码审查和文档生成
- 🛡️ **命令确认**：安全的命令确认交互功能，AI建议命令后用户确认执行
- 🚀 **开箱即用**：无需复杂配置，快速开始

## 🛠 工具生态 (27个工具)

### 🛡️ 命令确认工具 (2个) - ⭐ 安全执行
- **命令确认** (`command_confirmation`): 显示命令供用户确认执行，提供安全的命令交互体验
- **批量命令确认** (`batch_command_confirmation`): 显示多个命令供用户选择和执行

### 🤖 智能工具 (2个)
- **智能代码审查** (`smart_code_review`): 使用LLM分析代码质量、安全性和性能
- **智能文档生成** (`smart_doc_generator`): 基于代码自动生成API文档和README

### 📂 文件系统工具 (4个)
- `file_read`: 读取文件内容
- `file_write`: 写入文件内容  
- `directory_list`: 列出目录内容
- `file_info`: 获取文件详细信息

### 🌐 网络工具 (4个)
- `http_request`: 发送HTTP请求
- `url_parse`: 解析 URL 的各个组成部分
- `url_build`: 构建 URL
- `json_format`: 格式化或压缩 JSON

### 📝 文本处理工具 (4个)
- `text_length`: 计算文本长度和统计
- `text_format`: 格式化文本（大小写转换、去除空白等）
- `text_search`: 在文本中搜索指定内容
- `text_replace`: 替换文本中的指定内容

### 🔧 实用工具 (4个)
- `timestamp`: 时间戳处理
- `uuid`: UUID生成
- `random`: 生成随机数或随机字符串
- `base64`: Base64编码解码

### 📊 Git工具 (7个)
- `git_status`: 查看仓库状态
- `git_log`: 查看提交历史
- `git_diff`: 查看文件差异
- `git_branch`: 管理分支
- `git_add`: 添加文件到暂存区
- `git_commit`: 提交变更
- `git_smart_commit`: **🤖 智能提交** - 使用LLM分析变更并生成提交信息

## 🛡️ 命令确认功能

Blade 支持安全的命令确认交互功能，让AI建议的命令可以安全、透明地执行。

### 🎯 核心特性

- **📋 命令展示** - 清晰显示建议的命令和说明
- **🔍 风险评估** - 自动显示命令的风险级别 (安全/中等/高风险)
- **✅ 用户确认** - 交互式 Yes/No 确认机制
- **⚡ 实时执行** - 确认后立即执行命令
- **📊 执行统计** - 显示执行时间和结果

### 🎮 使用方式

#### 1. 在 AI 对话中使用（推荐）

```bash
# AI 会自动使用命令确认工具
blade chat "请使用命令确认工具帮我查看当前目录文件"
blade chat "用命令确认工具执行 git status 命令"
```

#### 2. 直接调用工具

```bash
# 单个命令确认
blade tools call command_confirmation \
  --params '{"command": "ls -la", "description": "查看文件详情", "riskLevel": "safe"}'

# 批量命令选择
blade tools call batch_command_confirmation \
  --params '{"commands": [
    {"command": "pwd", "description": "显示目录", "riskLevel": "safe"},
    {"command": "date", "description": "显示时间", "riskLevel": "safe"}
  ]}'
```

### 🎨 交互界面示例

```
📋 建议执行以下命令:
  ls -la
  说明: 列出当前目录的详细文件信息
  工作目录: /Users/demo/project
  风险级别: 安全

? 是否执行此命令？ (y/N)
```

执行后：
```
⚡ 正在执行命令...
✅ 命令执行成功 (89ms)

📤 输出:
total 32
drwxr-xr-x  8 user  staff   256 Jan 15 10:30 .
-rw-r--r--  1 user  staff  1234 Jan 15 10:30 package.json
```

## 🛠 安装与配置

### 安装方式

```bash
# 方式1: 全局安装（推荐）
npm install -g blade-ai

# 方式2: 使用 npx 临时运行（无需安装）
npx blade-ai chat 你好

# 方式3: 从源码安装
npm install
npm run build

# 方式4: 创建软链接（开发模式）
npm link
```

### 💡 三种使用方式对比

| 方式 | 命令示例 | 优点 | 缺点 |
|------|----------|------|------|
| **全局安装** | `blade chat 你好` | 简洁，响应快 | 需要安装到系统 |
| **npx运行** | `npx blade-ai chat 你好` | 无需安装，始终最新版本 | 首次运行较慢 |
| **源码运行** | `node bin/blade.js chat 你好` | 可修改源码 | 需要构建环境 |

### 🔐 配置 API 密钥

**重要提示：为了安全起见，Blade 不包含硬编码的API密钥。您需要通过以下方式之一提供API密钥：**

#### 方法1：环境变量（推荐）
```bash
# 千问 API 密钥
export QWEN_API_KEY="your-qwen-api-key"

# 火山引擎 API 密钥  
export VOLCENGINE_API_KEY="your-volcengine-api-key"
```

#### 方法2：.env 文件
```bash
# 复制配置示例文件
cp config.env.example .env

# 编辑 .env 文件，填入真实的API密钥
# QWEN_API_KEY=your-qwen-api-key-here
# VOLCENGINE_API_KEY=your-volcengine-api-key-here
```

#### 方法3：命令行参数
```bash
# 每次使用时通过 --api-key 参数提供
blade chat --api-key your-api-key "你好"
```

#### 📖 API密钥获取地址
- **千问 (Qwen)**: https://dashscope.console.aliyun.com/apiKey
- **火山引擎 (VolcEngine)**: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey

### 🔒 安全注意事项
- ❌ **永远不要**将API密钥提交到代码仓库
- ✅ 使用 `.env` 文件存储敏感信息（已加入 `.gitignore`）
- ✅ 定期轮换您的API密钥
- ✅ 为不同项目使用不同的API密钥

## 🎯 使用指南

> 💡 **快速试用**: 无需安装，直接使用 `npx blade-ai chat 你的问题`

### 💬 直接问答（推荐）

最简单的使用方式，直接提问获得答案：

```bash
# 全局安装后使用
blade chat 什么是人工智能
blade chat 解释一下微服务架构
blade chat 如何学习编程

# 或使用 npx（无需安装）
npx blade-ai chat 什么是人工智能
npx blade-ai chat 解释一下微服务架构
npx blade-ai chat 如何学习编程

# 🔥 流式输出（实时显示回答）
blade chat --stream "详细解释一下机器学习的原理"
npx blade-ai chat --stream "详细解释一下机器学习的原理"

# 智能代码审查
blade chat "请审查我的JavaScript代码文件 app.js"
npx blade-ai chat "请审查我的JavaScript代码文件 app.js"

# 智能文档生成
blade chat "为我的项目生成README文档"
npx blade-ai chat "为我的项目生成README文档"

# Git智能操作
blade chat "查看当前的代码变更并智能提交"
npx blade-ai chat "查看当前的代码变更并智能提交"

# 🛡️ 命令确认功能
blade chat "请使用命令确认工具帮我查看当前目录文件"
npx blade-ai chat "用命令确认工具执行 git status"

# 场景化问答
blade chat --scenario customer 我想要退货
npx blade-ai chat --scenario customer 我想要退货

# 指定提供商和模型
blade chat --provider volcengine --model ep-20250417144747-rgffm 你好
npx blade-ai chat --provider volcengine --model ep-20250417144747-rgffm 你好
```

### 🔧 工具管理

查看和使用各种内置工具：

```bash
# 查看所有工具
blade tools list

# 按分类查看工具
blade tools list --category smart
blade tools list --category git
blade tools list --category command

# 查看工具详情
blade tools info smart_code_review
blade tools info command_confirmation

# 直接调用工具
blade tools call uuid
blade tools call command_confirmation \
  --params '{"command": "echo Hello!", "description": "测试输出"}'
```

### 🔄 交互式聊天

进入持续对话模式：

```bash
# 启动交互式聊天（默认智能助手）
blade chat
blade chat --interactive

# 🔥 流式输出交互式聊天
blade chat --interactive --stream
blade chat -i --stream

# 场景化交互式聊天
blade chat -i --scenario customer
blade chat -i --scenario code
blade chat -i --scenario assistant

# 场景化 + 流式输出
blade chat -i --scenario assistant --stream
blade chat -i --scenario customer --stream

# 指定提供商的交互式聊天
blade chat -i --provider volcengine
blade chat -i --provider volcengine --stream
```

### 🎭 场景演示

查看预设场景的完整演示：

```bash
# 智能助手演示
blade chat --demo --scenario assistant

# 客服助手演示
blade chat --demo --scenario customer

# 代码助手演示
blade chat --demo --scenario code
```

### 🤖 纯 LLM 聊天

不使用 Agent 功能，直接与 LLM 对话：

```bash
# 启动纯 LLM 聊天
blade llm

# 流式输出聊天
blade llm --stream

# 指定提供商
blade llm --provider volcengine
```

### 📋 模型管理

查看和管理可用模型：

```bash
# 查看千问模型
blade models --provider qwen

# 查看豆包模型  
blade models --provider volcengine
```

## 📋 命令参考

| 命令 | 描述 | 主要参数 | 示例 |
|------|------|----------|------|
| `chat [question...]` | 智能 Agent 聊天 | `--scenario`, `--interactive`, `--demo` | `chat 你好` |
| `llm` | 纯 LLM 聊天模式 | `--provider`, `--stream` | `llm --stream` |
| `models` | 查看可用模型 | `--provider` | `models -p qwen` |
| `tools` | 工具管理和操作 | `list`, `info`, `call` | `tools call command_confirmation` |

### Chat 命令详细参数

```bash
blade chat [question...] [options]

参数:
  question                   要问的问题（可选）

选项:
  -p, --provider <provider>  选择 LLM 提供商 (volcengine|qwen) (默认: "qwen")
  -k, --api-key <key>        API 密钥
  -m, --model <model>        指定模型
  -s, --scenario <scenario>  选择场景 (customer|code|assistant) (默认: "assistant")
  -i, --interactive          启动交互式聊天模式
  --stream                   启用流式输出（实时显示回答）
  --demo                     运行场景演示
  -h, --help                 显示帮助信息
```

### Tools 命令详细参数

```bash
blade tools <command> [options]

命令:
  list [options]             📋 列出可用工具
  info <toolName>           🔍 查看工具详细信息  
  call <toolName> [options] ⚡ 调用指定工具
  docs                      📖 打开工具文档
```

## 🎭 场景介绍

### 🤖 智能助手 (assistant) - 默认
- **智能问答**：回答各种问题，提供详细解释
- **代码生成**：生成各种编程语言代码
- **工具集成**：自动调用合适的工具协助回答
- **智能分析**：使用智能工具进行代码审查和文档生成
- **命令确认**：安全执行AI建议的命令
- **适用场景**：通用问答、学习助手、技术咨询、开发辅助

```bash
# 示例
blade chat 什么是机器学习
blade chat 审查我的代码文件并给出建议
blade chat 为这个项目生成文档
blade chat 请使用命令确认工具查看目录
```

### 🎧 智能客服 (customer)
- **客户咨询处理**：专业的客服回复风格
- **情绪分析**：分析客户情绪并适当回应
- **标准化回复**：提供规范的客服用语
- **适用场景**：客户服务、投诉处理、咨询回复

```bash
# 示例  
blade chat --scenario customer 我想要退货
blade chat --scenario customer 产品质量有问题
```

### 💻 代码助手 (code)
- **代码审查**：从质量、性能、安全性等维度分析代码
- **代码优化**：提供具体的改进建议
- **智能Git操作**：分析变更并生成合适的提交信息
- **文档生成**：自动生成API文档和技术说明
- **命令执行**：使用命令确认工具安全执行代码相关命令
- **适用场景**：代码 review、性能优化、学习编程、项目维护

```bash
# 示例
blade chat --scenario code 如何优化这个函数
blade chat --scenario code 审查我的JavaScript代码
blade chat --scenario code 帮我提交当前的代码变更
blade chat --scenario code 用命令确认工具执行构建命令
```

## 🤖 智能工具详解

### 智能代码审查 (`smart_code_review`)

使用LLM深度分析代码质量，提供专业的审查报告：

```bash
# 通过Agent智能聊天使用（推荐）
blade chat "请审查 src/utils.js 的代码质量"
blade chat "检查 app.ts 的安全性问题"
blade chat "分析 components/User.jsx 的性能问题"
```

**功能特点：**
- 🔍 **多维度分析**：代码质量、安全性、性能、可维护性
- 🎯 **专项检查**：可选择特定审查类型（security/performance/style等）
- 📊 **详细报告**：问题分类、严重程度、具体建议
- 🌐 **多语言支持**：支持20+编程语言自动检测

### 智能文档生成 (`smart_doc_generator`)

基于代码结构智能生成项目文档：

```bash
# 通过Agent智能聊天使用（推荐）
blade chat "为 src/ 目录生成API文档"
blade chat "分析整个项目并生成README"
blade chat "为这个库生成用户指南"
```

**功能特点：**
- 📝 **多种文档类型**：API文档、README、用户指南、技术文档
- 🔄 **自动分析**：扫描代码结构，提取函数、类、导出信息
- 💡 **智能生成**：基于实际代码生成准确的使用示例
- 📋 **标准化格式**：遵循Markdown规范，结构清晰

### Git智能提交 (`git_smart_commit`)

分析代码变更并使用LLM生成规范的提交信息：

```bash
# 通过Agent智能聊天使用（推荐）
blade chat "查看当前变更并智能提交"
blade chat "分析diff生成commit信息"

# 也可以直接使用Git工具
blade tools call git_smart_commit
```

**功能特点：**
- 🧠 **智能分析**：LLM深度理解代码变更内容
- 📏 **规范格式**：生成符合Conventional Commits规范的提交信息
- 🔄 **完整流程**：自动添加文件、分析、生成信息、执行提交
- 👁️ **预览模式**：支持干运行，预览提交信息而不实际提交

### 命令确认工具 (`command_confirmation`)

安全的命令确认交互：

```bash
# 通过Agent智能聊天使用（推荐）
blade chat "请使用命令确认工具查看当前目录"
blade chat "用命令确认工具执行 git status"

# 直接调用工具
blade tools call command_confirmation \
  --params '{"command": "ls -la", "description": "查看文件"}'
```

**功能特点：**
- 📋 **命令展示**：清晰显示建议的命令和说明
- 🔍 **风险评估**：自动显示命令的风险级别
- ✅ **用户确认**：交互式 Yes/No 确认机制
- ⚡ **实时执行**：确认后立即执行命令
- 📊 **执行反馈**：显示执行时间和结果

## 🌐 支持的模型

### 千问 (Qwen) - 14个模型
- `qwen3-235b-a22b` (默认) - 最新旗舰模型，智能工具优化
- `qwen-plus-latest` - Plus版本
- `qwen-turbo-latest` - 快速版本
- `qwen-max-latest` - 最大版本
- `qwen-long` - 长文本版本
- 等更多模型...

### 豆包 (VolcEngine) - 3个模型
- `ep-20250417144747-rgffm` (默认) - 豆包原生模型
- `ep-20250530171307-rrcc5` - DeepSeek R1 250528，推理能力强
- `ep-20250530171222-q42h8` - DeepSeek V3，综合性能优秀

## 🚀 快速开始

### ⚡ 零安装试用（推荐新手）
```bash
# 无需安装，直接试用
npx blade-ai chat 你好

# 配置API密钥后开始使用
export QWEN_API_KEY="your-qwen-api-key"
npx blade-ai chat "审查我的代码文件"
npx blade-ai chat "请使用命令确认工具查看目录"
```

### 🔧 完整安装

#### 1. 环境准备
```bash
# 全局安装（推荐）
npm install -g blade-ai

# 或从源码安装
git clone https://github.com/echoVic/Blade.git
cd blade

# 安装依赖
npm install

# 构建项目
npm run build

# 创建本地链接
npm link
```

#### 2. 配置API密钥 ⚠️ 必需步骤

**⚠️ 重要：没有配置API密钥将无法使用任何AI功能！**

获取API密钥：
- 千问: https://dashscope.console.aliyun.com/apiKey
- 火山引擎: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey

### 3. 开始使用

```bash
# 检查配置（如果没有配置API密钥会有友好提示）
blade chat 你好

# 智能代码审查
blade chat "审查我的代码文件"

# 命令确认功能
blade chat "请使用命令确认工具查看当前目录"

# 查看所有工具
blade tools list

# 查看帮助
blade --help
```

### 4. 常见问题

**Q: 出现"API密钥配置错误"怎么办？**

A: 请确保已正确配置API密钥：
```bash
# 检查环境变量
echo $QWEN_API_KEY

# 或使用命令行参数
blade chat --api-key your-api-key "测试"
```

**Q: 如何更换不同的模型？**

A: 使用 --model 参数：
```bash
# 千问模型
blade chat --model qwen-max-latest "你好"

# 火山引擎模型  
blade chat --provider volcengine --model ep-20250530171222-q42h8 "你好"
```

**Q: 命令确认工具如何使用？**

A: 有两种方式：
```bash
# 1. 在对话中自然使用
blade chat "请使用命令确认工具帮我查看目录"

# 2. 直接调用工具
blade tools call command_confirmation \
  --params '{"command": "ls -la", "description": "查看文件"}'
```

## 💡 使用技巧

### 🎯 选择合适的使用方式

- **直接问答**：`chat 你的问题` - 适合快速获得答案，自动调用工具
- **流式问答**：`chat --stream 你的问题` - 实时显示回答，体验更流畅
- **交互式聊天**：`chat -i` - 适合持续对话和复杂任务
- **流式交互**：`chat -i --stream` - 交互式 + 实时输出，最佳聊天体验
- **工具直调**：`tools call tool_name` - 适合简单工具的快速调用
- **场景演示**：`chat --demo` - 了解功能特性

### 🎭 选择合适的场景

- **通用问答**：使用默认 `assistant` 场景，支持智能工具调用和命令确认
- **客服相关**：使用 `customer` 场景，获得专业客服回复
- **编程相关**：使用 `code` 场景，自动优化代码分析和命令执行工具调用

### 🤖 智能工具最佳实践

- **代码审查**：通过自然语言描述需求，Agent自动选择合适的审查类型
- **文档生成**：描述文档需求和目标用户，获得更精准的文档
- **Git操作**：让Agent分析变更上下文，生成更有意义的提交信息
- **命令确认**：说"请使用命令确认工具"让AI安全执行命令

### ⚡ 提升体验

- 使用 `--stream` 参数获得实时输出
- 在交互模式中输入 `quit` 或 `exit` 优雅退出
- 善用工具分类查看：`tools list --category command`
- 通过自然语言与命令确认工具交互，获得安全高效的体验

## 🔧 开发

### 项目结构

```
src/
├── agent/           # Agent 核心框架
│   ├── Agent.ts     # 主要 Agent 类（智能工具集成）
│   ├── BaseComponent.ts
│   └── ToolComponent.ts
├── tools/           # 工具系统
│   ├── builtin/     # 内置工具
│   │   ├── command-confirmation.ts # 🛡️ 命令确认工具
│   │   ├── smart/   # 🤖 智能工具
│   │   ├── git/     # Git工具
│   │   ├── file-system.ts
│   │   ├── network.ts
│   │   └── utility.ts
│   ├── ToolManager.ts
│   └── types.ts
├── llm/             # LLM 实现
│   ├── BaseLLM.ts   # LLM 基类
│   ├── QwenLLM.ts   # 千问实现
│   └── VolcEngineLLM.ts # 豆包实现
├── config/          # 配置管理
├── commands/        # CLI 命令实现
│   ├── agent-llm.ts # chat 命令
│   ├── llm.ts       # llm 和 models 命令
│   └── tools.ts     # tools 命令
└── index.ts         # 主入口
```

### 构建与开发

```bash
# 构建
npm run build

# 开发模式
npm run dev

# 类型检查
npm run type-check

# 代码格式化
npm run format
```

## 💻 编程接口

### Agent 使用示例

```typescript
import { Agent, AgentConfig } from 'blade-ai';

// 创建 Agent 配置
const config: AgentConfig = {
  debug: false,
  llm: {
    provider: 'qwen',
    apiKey: process.env.QWEN_API_KEY,
    model: 'qwen3-235b-a22b'
  },
  tools: {
    enabled: true,
    includeBuiltinTools: true,
    includeCategories: ['smart', 'git', 'filesystem', 'command']
  }
};

// 创建并初始化 Agent
const agent = new Agent(config);
await agent.init();

// 使用智能聊天（自动调用工具）
const response = await agent.smartChat('请审查我的代码文件 app.js');

// 使用命令确认功能
const cmdResponse = await agent.smartChat('请使用命令确认工具查看目录');

// 使用各种 Agent 功能
const answer = await agent.ask('什么是人工智能？');
const code = await agent.generateCode('快速排序算法', 'python');
const review = await agent.reviewCode(sourceCode, 'javascript');

// 直接调用命令确认工具
const confirmResult = await agent.callTool('command_confirmation', {
  command: 'ls -la',
  description: '查看目录文件',
  riskLevel: 'safe'
});

// 直接调用智能工具
const reviewResult = await agent.callTool('smart_code_review', {
  path: 'src/utils.js',
  reviewType: 'security'
});

// 获取可用工具
const tools = agent.getAvailableTools();
const commandTools = agent.searchTools('command');

// 清理资源
await agent.destroy();
```

### 工具管理器使用示例

```typescript
import { createToolManager } from 'blade-ai';

// 创建工具管理器
const toolManager = await createToolManager();

// 调用命令确认工具
const result = await toolManager.callTool({
  toolName: 'command_confirmation',
  parameters: { 
    command: 'git status',
    description: '检查仓库状态',
    riskLevel: 'safe'
  }
});

// 调用批量命令确认
const batchResult = await toolManager.callTool({
  toolName: 'batch_command_confirmation',
  parameters: {
    commands: [
      { command: 'pwd', description: '显示目录', riskLevel: 'safe' },
      { command: 'date', description: '显示时间', riskLevel: 'safe' }
    ]
  }
});

// 调用智能工具（需要LLM支持）
const smartResult = await toolManager.callTool({
  toolName: 'smart_code_review',
  parameters: { path: 'app.js' }
});

// 调用普通工具
const uuid = await toolManager.callTool({
  toolName: 'uuid',
  parameters: {}
});

// 获取工具信息
const tools = toolManager.getTools();
const commandTools = toolManager.getToolsByCategory('command');
```

### 纯 LLM 使用示例

```typescript
import { QwenLLM, getProviderConfig } from 'blade-ai';

const config = getProviderConfig('qwen');
const llm = new QwenLLM(config.apiKey, config.defaultModel);

await llm.init();

// 单次对话
const response = await llm.chat([
  { role: 'user', content: '你好！' }
]);

// 流式对话
await llm.streamChat([
  { role: 'user', content: '讲个故事' }
], (chunk) => {
  process.stdout.write(chunk);
});

await llm.destroy();
```

## 📖 文档

- [Git 工具文档](docs/git-tools.md) - 详细的Git工具使用指南
- [工具开发文档](docs/tool-development.md) - 如何开发自定义工具
- [智能工具文档](docs/smart-tools.md) - 智能工具的详细使用说明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License 

## 🗡️ Blade 特色功能

### 🛡️ 命令确认
Blade 支持安全的命令确认交互功能，让AI建议的命令可以安全、透明地执行。通过简单的对话即可触发，用户始终保持对命令执行的完全控制。

### 🤖 智能工具集成
完整的智能工具生态，包括代码审查、文档生成、Git智能操作等，所有工具都可以通过自然语言对话触发，无需记忆复杂的命令参数。

### 💬 多场景对话
支持不同专业场景的对话模式，从通用助手到专业客服，从代码助手到技术顾问，每个场景都经过精心优化。

这就是 **Blade** - 一个真正智能的 CLI Agent，让命令行交互变得简单、安全、高效！ 

## 📦 发布管理

### 🚀 自动发包

项目提供了完整的自动化发包工具，支持版本管理、changelog 生成和安全发布：

```bash
# 🔍 预览发布过程 (推荐)
npm run release:dry

# 📦 发布补丁版本 (1.0.0 -> 1.0.1)
npm run release

# 🚀 发布次版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 🎯 发布主版本 (1.0.0 -> 2.0.0)
npm run release:major
```

### ✨ 功能特性

- **🔍 智能版本检测** - 自动检查 Git tags 和 npm registry 版本冲突
- **📝 自动 Changelog** - 基于提交信息自动生成版本日志
- **🛡️ 安全检查** - 工作目录状态、代码质量、测试验证
- **⚙️ 灵活配置** - 通过 `release.config.js` 自定义发布流程
- **🏃 预演模式** - 安全预览所有发布步骤

### 📋 发布流程

1. 预发布检查（项目基本信息、依赖安全、文档）
2. 检查工作目录和代码质量
3. 智能递增版本号（避免冲突）
4. 自动生成 changelog
5. 构建项目和运行测试
6. 创建 Git 标签和发布到 npm
7. 推送到远程仓库

详细使用指南：[📚 发布指南](docs/release-guide.md) 