# 🤖 智能工具文档

Agent CLI 的智能工具集合使用LLM技术增强传统工具功能，提供更智能、更人性化的代码分析和文档生成体验。

## 🌟 智能工具概览

| 工具名称 | 功能描述 | 主要特点 | 适用场景 |
|---------|----------|----------|----------|
| `smart_code_review` | 智能代码审查 | LLM深度分析、多维度评估 | 代码质量检查、安全审计 |
| `smart_doc_generator` | 智能文档生成 | 基于代码结构、自动生成 | API文档、项目说明 |

## 🔍 智能代码审查 (smart_code_review)

### 功能概述
使用大语言模型深度分析代码质量，从多个维度提供专业的审查报告和改进建议。

### 核心特性
- 🧠 **LLM驱动分析**：利用大语言模型的理解能力，提供专业的代码分析
- 🔍 **多维度评估**：安全性、性能、可维护性、代码风格全面覆盖
- 📊 **详细报告**：问题分类、严重程度评级、具体改进建议
- 🌐 **多语言支持**：自动识别20+种编程语言
- 🎯 **专项检查**：支持针对性的安全、性能或风格检查

### 参数说明

```typescript
{
  path: string,              // 必需：要审查的代码文件路径
  reviewType?: string,       // 可选：审查类型
  language?: string,         // 可选：编程语言（auto自动检测）
  maxFileSize?: number       // 可选：最大文件大小（默认100KB）
}
```

**reviewType 选项：**
- `full` (默认)：全面审查，涵盖所有维度
- `security`：专注安全性问题检查
- `performance`：专注性能优化分析
- `style`：专注代码风格和规范
- `maintainability`：专注可维护性评估

### 使用方法

#### 1. 通过Agent智能聊天（推荐）

```bash
# 全面代码审查
node dist/index.js chat "请审查 src/utils.js 的代码质量"

# 安全性专项检查
node dist/index.js chat "检查 app.ts 的安全漏洞"

# 性能分析
node dist/index.js chat "分析 components/UserList.jsx 的性能问题"

# 代码风格检查
node dist/index.js chat "检查 api/routes.js 的代码规范"
```

#### 2. 使用Agent编程接口

```typescript
import { Agent } from 'agent-cli';

const agent = new Agent({
  llm: { provider: 'qwen', apiKey: 'your-key' }
});
await agent.init();

// 通过智能聊天
const result = await agent.smartChat('审查 src/index.ts 的代码质量');

// 直接调用工具
const review = await agent.callTool('smart_code_review', {
  path: 'src/index.ts',
  reviewType: 'security'
});

console.log(review.result);
```

### 报告格式

智能代码审查工具返回结构化的分析报告：

```json
{
  "fileInfo": {
    "path": "/path/to/file.js",
    "language": "javascript",
    "size": 2048,
    "lines": 85,
    "reviewType": "full",
    "reviewedAt": "2024-01-01T12:00:00.000Z"
  },
  "codeStats": {
    "totalLines": 85,
    "codeLines": 65,
    "commentLines": 8,
    "blankLines": 12,
    "commentRatio": 0.094,
    "avgLineLength": 24.1
  },
  "analysis": {
    "overallScore": 7,
    "summary": "代码整体结构清晰，但存在安全性和性能问题需要改进",
    "issues": [
      {
        "type": "security",
        "severity": "high",
        "description": "SQL注入漏洞：直接拼接用户输入到SQL查询",
        "suggestion": "使用参数化查询或ORM防止SQL注入",
        "lineRange": "15-17"
      }
    ],
    "strengths": [
      "代码结构清晰，模块化设计良好",
      "函数命名规范，易于理解"
    ],
    "recommendations": [
      "添加输入参数验证",
      "引入错误处理机制",
      "使用现代ES6+语法"
    ],
    "securityConcerns": [
      "SQL注入风险",
      "缺少输入验证"
    ],
    "performanceNotes": [
      "避免嵌套循环",
      "考虑使用缓存机制"
    ],
    "maintainabilityScore": 6
  },
  "smartGenerated": true
}
```

### 支持的编程语言

- **Web开发**：JavaScript, TypeScript, HTML, CSS
- **后端开发**：Python, Java, Go, PHP, Ruby, C#
- **系统编程**：C, C++, Rust
- **移动开发**：Swift, Kotlin, Dart
- **其他**：Shell, SQL, JSON, YAML, XML

## 📝 智能文档生成 (smart_doc_generator)

### 功能概述
基于代码结构分析，使用LLM智能生成项目文档，包括API文档、README、用户指南等。

### 核心特性
- 🔄 **代码结构分析**：自动扫描和分析代码文件结构
- 📝 **多文档类型**：支持API文档、README、技术指南等
- 💡 **智能生成**：基于实际代码生成准确的使用示例
- 📋 **标准格式**：遵循Markdown规范，结构清晰
- 🎯 **自动检测**：智能判断最适合的文档类型

### 参数说明

```typescript
{
  sourcePath: string,        // 必需：源代码文件或目录路径
  outputPath?: string,       // 可选：输出文档路径
  docType?: string,          // 可选：文档类型
  language?: string,         // 可选：编程语言
  includeExamples?: boolean, // 可选：是否包含示例（默认true）
  maxFileSize?: number,      // 可选：单文件最大大小（默认200KB）
  overwrite?: boolean        // 可选：是否覆盖已存在文件
}
```

**docType 选项：**
- `auto` (默认)：自动检测最适合的文档类型
- `api`：API参考文档
- `readme`：项目README文档
- `guide`：用户使用指南
- `technical`：技术文档

### 使用方法

#### 1. 通过Agent智能聊天（推荐）

```bash
# 分析单个文件生成文档
node dist/index.js chat "为 src/api.js 生成API文档"

# 分析目录生成项目文档
node dist/index.js chat "分析 src/ 目录并生成README"

# 生成特定类型文档
node dist/index.js chat "为这个工具库生成用户指南"

# 指定输出位置
node dist/index.js chat "分析代码并生成文档到 docs/api.md"
```

#### 2. 使用Agent编程接口

```typescript
import { Agent } from 'agent-cli';

const agent = new Agent({
  llm: { provider: 'qwen', apiKey: 'your-key' }
});
await agent.init();

// 通过智能聊天
const result = await agent.smartChat('为 src/ 目录生成API文档');

// 直接调用工具
const docResult = await agent.callTool('smart_doc_generator', {
  sourcePath: 'src/',
  docType: 'api',
  outputPath: 'docs/API.md',
  includeExamples: true,
  overwrite: true
});

console.log(docResult.result);
```

### 代码分析过程

1. **文件扫描**：递归扫描指定目录，识别代码文件
2. **结构分析**：提取函数、类、导出、导入等代码结构
3. **语言检测**：自动识别主要编程语言
4. **文档类型判断**：基于代码特征选择最适合的文档类型
5. **LLM生成**：使用大语言模型生成专业文档内容
6. **格式处理**：标准化Markdown格式并添加元信息

### 生成的文档结构

智能文档生成工具会创建包含以下部分的完整文档：

```markdown
# 项目名称

## 项目概述
简明扼要地描述项目功能和用途

## 安装说明
如何安装和配置项目

## 快速开始
基本使用方法和入门示例

## API文档
主要函数、类和方法的详细说明

## 使用示例
实际的代码示例展示如何使用

## 配置选项
重要的配置参数和选项

## 故障排除
常见问题和解决方案

## 贡献指南
如何参与项目开发

---
*此文档由 Agent CLI 智能生成，生成时间：2024-01-01*
```

### 返回结果

```json
{
  "sourceInfo": {
    "path": "/path/to/source",
    "type": "directory",
    "fileCount": 15,
    "primaryLanguage": "typescript"
  },
  "documentInfo": {
    "path": "/path/to/output/README.md",
    "type": "readme",
    "size": 8192,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "includesExamples": true
  },
  "analysis": {
    "fileCount": 15,
    "primaryLanguage": "typescript",
    "languages": { "typescript": 12, "javascript": 3 },
    "totalLines": 2500,
    "structures": {
      "functions": ["createUser", "updateUser", "deleteUser"],
      "classes": ["UserService", "UserRepository"],
      "exports": ["export class UserService", "export const config"],
      "imports": ["import express from 'express'"]
    }
  },
  "smartGenerated": true
}
```

## 💡 最佳实践

### 代码审查最佳实践

1. **选择合适的审查类型**
   ```bash
   # 新功能开发 - 全面审查
   node dist/index.js chat "全面审查新功能代码 src/features/payment.js"
   
   # 安全敏感代码 - 安全专项
   node dist/index.js chat "检查用户认证模块的安全性 auth/login.js"
   
   # 性能关键路径 - 性能专项
   node dist/index.js chat "分析搜索算法的性能 search/algorithm.js"
   ```

2. **批量审查策略**
   ```bash
   # 审查整个模块
   node dist/index.js chat "审查 src/user/ 模块的所有代码文件"
   
   # 重点文件审查
   node dist/index.js chat "审查核心业务逻辑文件 src/core/business.js"
   ```

3. **结合其他工具**
   ```bash
   # 先查看变更，再进行审查
   node dist/index.js chat "查看最近的代码变更并进行审查"
   ```

### 文档生成最佳实践

1. **明确文档目标**
   ```bash
   # 面向用户的文档
   node dist/index.js chat "生成面向开发者的API使用文档"
   
   # 内部技术文档
   node dist/index.js chat "生成项目内部架构技术文档"
   ```

2. **渐进式文档生成**
   ```bash
   # 先生成核心模块文档
   node dist/index.js chat "为核心业务模块生成API文档"
   
   # 再生成完整项目文档
   node dist/index.js chat "基于现有模块文档生成完整项目README"
   ```

3. **持续更新**
   ```bash
   # 代码变更后更新文档
   node dist/index.js chat "代码已更新，请更新相应的API文档"
   ```

## 🔧 技术原理

### LLM集成机制

智能工具采用二阶段执行模式：

1. **分析阶段**：工具分析输入，构造专业的LLM提示
2. **生成阶段**：LLM处理提示，生成智能分析结果
3. **整合阶段**：工具处理LLM输出，生成最终结果

### 错误处理

智能工具具备完善的错误处理机制：

- **输入验证**：文件大小、格式、权限检查
- **LLM调用**：超时处理、重试机制、降级策略
- **输出处理**：格式验证、内容清理、默认值设置

### 性能优化

- **文件大小限制**：避免处理过大文件影响性能
- **智能截取**：对长文件进行智能截取保留关键信息
- **缓存机制**：Agent级别的LLM调用缓存
- **批量处理**：支持目录级别的批量文件处理

## 🚀 扩展开发

### 自定义智能工具

可以基于现有框架开发新的智能工具：

```typescript
import type { ToolDefinition } from '../types.js';

export const customSmartTool: ToolDefinition = {
  name: 'custom_smart_tool',
  description: '自定义智能工具',
  category: 'smart',
  version: '1.0.0',
  
  parameters: {
    // 定义参数
    llmAnalysis: {
      type: 'string',
      required: false,
      description: 'LLM分析结果（由Agent自动填充）',
      default: ''
    }
  },

  async execute(parameters) {
    const { llmAnalysis = '' } = parameters;
    
    // 如果没有LLM分析，返回需要分析的信号
    if (!llmAnalysis) {
      return {
        success: false,
        error: 'need_llm_analysis',
        data: {
          needsLLMAnalysis: true,
          analysisPrompt: '构造给LLM的分析提示'
        }
      };
    }
    
    // 处理LLM分析结果
    const result = processLLMResult(llmAnalysis);
    
    return {
      success: true,
      data: result
    };
  }
};
```

### 集成到Agent

智能工具自动集成到Agent系统，支持：

- **自然语言调用**：通过对话自动识别和调用
- **参数推理**：从对话上下文推理工具参数
- **结果整合**：将工具结果整合到自然语言回复中

## 📊 性能指标

| 指标 | 代码审查 | 文档生成 |
|------|----------|----------|
| 支持文件大小 | 100KB | 200KB |
| 处理时间 | 10-30秒 | 15-45秒 |
| 支持语言数 | 20+ | 15+ |
| 准确性 | 85-95% | 90-95% |

## 🔍 故障排除

### 常见问题

1. **文件太大错误**
   ```
   解决：调整maxFileSize参数或拆分文件
   ```

2. **LLM分析超时**
   ```
   解决：检查网络连接，重试操作
   ```

3. **语言识别错误**
   ```
   解决：手动指定language参数
   ```

4. **输出格式错误**
   ```
   解决：检查LLM返回内容，工具会自动处理大部分格式问题
   ```

### 调试模式

启用Agent调试模式查看详细日志：

```typescript
const agent = new Agent({
  debug: true,
  llm: { provider: 'qwen', apiKey: 'your-key' }
});
```

## 📈 未来计划

- 🔄 **增量分析**：支持基于Git差异的增量代码审查
- 🌐 **更多语言**：扩展对更多编程语言的支持
- 📊 **质量趋势**：跟踪项目代码质量变化趋势
- 🤖 **自动修复**：基于审查结果自动生成修复建议
- 📝 **模板定制**：支持自定义文档生成模板 