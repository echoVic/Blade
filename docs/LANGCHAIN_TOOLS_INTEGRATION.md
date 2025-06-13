# BladeAgent × LangChain 工具集成

## 🎯 概述

BladeAgent 现已完全支持 LangChain 内置工具，可以无缝集成 `DynamicTool` 和 `DynamicStructuredTool`，提供强大的工具执行能力。

## ✨ 主要特性

### 🔧 支持的工具类型
- **DynamicTool**: 适用于简单字符串输入的工具
- **DynamicStructuredTool**: 适用于复杂对象输入的工具
- **自定义工具**: 扩展 LangChain 工具接口的自定义实现

### 🧠 智能解析
- **JSON 解析**: 自动解析 LLM 返回的 JSON 格式工具调用
- **嵌套结构**: 支持复杂嵌套参数结构
- **错误恢复**: 优雅处理解析失败的情况

### 📊 执行监控
- **状态跟踪**: 实时监控工具执行状态
- **性能指标**: 记录执行时间和成功率
- **调试模式**: 详细的执行日志和错误信息

## 🚀 快速开始

### 1. 创建 LangChain 工具

```typescript
import { DynamicTool, DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// 简单工具
const timeTool = new DynamicTool({
  name: 'getCurrentTime',
  description: '获取当前时间',
  func: async (_input: string) => {
    return `当前时间: ${new Date().toLocaleString('zh-CN')}`;
  }
});

// 结构化工具
const calculatorTool = new DynamicStructuredTool({
  name: 'calculator',
  description: '计算器工具',
  schema: z.object({
    expression: z.string().describe('数学表达式')
  }),
  func: async ({ expression }) => {
    const result = eval(expression);
    return `计算结果: ${expression} = ${result}`;
  }
});
```

### 2. 集成到 BladeAgent

```typescript
import { BladeAgent } from '../src/langchain/agents/BladeAgent.js';

// 创建工具管理器
const tools = [timeTool, calculatorTool];
const toolkit = {
  hasTool: (name: string) => tools.some(tool => tool.name === name),
  executeTool: async (toolName: string, params: any) => {
    const tool = tools.find(t => t.name === toolName);
    if (!tool) throw new Error(`工具 ${toolName} 不存在`);
    
    return tool instanceof DynamicTool 
      ? await tool.invoke(JSON.stringify(params))
      : await tool.invoke(params);
  }
};

// 创建 Agent
const agent = new BladeAgent({
  llm: yourLangChainLLM,
  toolkit,
  maxIterations: 3,
  debug: true
});
```

### 3. 执行任务

```typescript
// Agent 会自动识别并执行相应工具
const response = await agent.invoke('现在几点了？');
console.log(response.content); // "当前时间: 2024-01-15 14:30:00"

const mathResponse = await agent.invoke('计算 25 + 17');
console.log(mathResponse.content); // "计算结果: 25 + 17 = 42"
```

## 🔄 执行流程

1. **思考阶段**: LLM 分析用户输入，确定是否需要工具
2. **规划阶段**: 生成 JSON 格式的工具调用计划
3. **解析阶段**: BladeAgent 解析 JSON 提取工具信息
4. **执行阶段**: 调用对应的 LangChain 工具
5. **观察阶段**: 收集工具执行结果
6. **完成阶段**: 返回最终结果给用户

## 📝 JSON 格式规范

BladeAgent 期望 LLM 返回以下格式的 JSON：

```json
{
  "tool": "toolName",
  "params": {
    "param1": "value1",
    "param2": "value2"
  },
  "reason": "执行原因说明"
}
```

## 🔍 调试模式

启用调试模式可以看到详细的执行过程：

```typescript
const agent = new BladeAgent({
  // ... 其他配置
  debug: true  // 启用调试模式
});
```

调试输出示例：
```
🔧 解析到工具调用: getCurrentTime
🔧 工具执行完成: getCurrentTime (completed)
✅ 任务完成: getCurrentTime
```

## 🎯 最佳实践

### 1. 工具设计
- 保持工具职责单一明确
- 提供清晰的描述和参数说明
- 处理边界情况和错误

### 2. 性能优化
- 避免长时间运行的工具
- 使用适当的超时设置
- 缓存重复计算结果

### 3. 错误处理
- 优雅处理工具执行失败
- 提供有意义的错误信息
- 支持重试和回退策略

## 📖 示例代码

完整的集成示例请参考：`examples/langchain-tools-integration.ts`

## 🔗 相关资源

- [LangChain Tools 官方文档](https://v03.api.js.langchain.com/modules/langchain.tools.html)
- [BladeAgent API 文档](./BLADE_AGENT_API.md)
- [工具开发指南](./TOOL_DEVELOPMENT.md) 