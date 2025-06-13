/**
 * BladeAgent 与 LangChain 工具集成示例
 *
 * 此示例展示如何使用 BladeAgent 与 LangChain 内置工具：
 * - DynamicTool (简单字符串输入)
 * - DynamicStructuredTool (结构化对象输入)
 */

import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BladeAgent } from '../src/langchain/agents/BladeAgent.js';

async function demonstrateLangChainToolsIntegration() {
  console.log('🔧 BladeAgent × LangChain 工具集成演示\n');

  // 1. 创建 LangChain 内置工具
  const timeTool = new DynamicTool({
    name: 'getCurrentTime',
    description: '获取当前时间',
    func: async (_input: string) => {
      const now = new Date();
      return `当前时间: ${now.toLocaleString('zh-CN')}`;
    },
  });

  const calculatorTool = new DynamicStructuredTool({
    name: 'calculator',
    description: '计算器工具，可以进行基本数学运算',
    schema: z.object({
      expression: z.string().describe('要计算的数学表达式，如 "2+3" 或 "10*5"'),
    }),
    func: async ({ expression }: { expression: string }) => {
      try {
        const cleanExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
        const result = eval(cleanExpression);
        return `计算结果: ${cleanExpression} = ${result}`;
      } catch (error) {
        return `计算失败: ${error}`;
      }
    },
  });

  // 2. 创建工具管理器
  const tools = [timeTool, calculatorTool];
  const toolMap = new Map(tools.map(tool => [tool.name, tool]));

  const simpleToolkit = {
    listTools: () => {
      return `可用工具:\n${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}`;
    },

    hasTool: (name: string) => toolMap.has(name),

    executeTool: async (toolName: string, params: any) => {
      const tool = toolMap.get(toolName);
      if (!tool) {
        throw new Error(`工具 ${toolName} 不存在`);
      }

      if (tool instanceof DynamicTool) {
        const input = typeof params === 'string' ? params : JSON.stringify(params);
        return await tool.invoke(input);
      }

      if (tool instanceof DynamicStructuredTool) {
        return await tool.invoke(params);
      }

      throw new Error(`未知的工具类型: ${toolName}`);
    },
  };

  // 3. 创建模拟 LLM（实际使用时替换为真实的 LangChain LLM）
  const mockLLM = {
    async invoke(messages: any[]) {
      const lastMessage = messages[messages.length - 1];
      const input = lastMessage.content.toLowerCase();

      // 简单的意图识别
      if (input.includes('时间') || input.includes('现在几点')) {
        return {
          content: `思考: 用户询问时间，我需要使用 getCurrentTime 工具。
行动: 获取当前时间
{
  "tool": "getCurrentTime",
  "params": {},
  "reason": "用户想知道当前时间"
}`,
        };
      } else if (input.includes('计算') || input.includes('算') || /\d+[\+\-\*\/]\d+/.test(input)) {
        const mathMatch = input.match(/(\d+[\+\-\*\/\d\s\(\)\.]+)/);
        const expression = mathMatch ? mathMatch[1].trim() : '2+2';

        return {
          content: `思考: 用户要求进行数学计算。
行动: 使用计算器工具
{
  "tool": "calculator",
  "params": {"expression": "${expression}"},
  "reason": "用户需要进行数学计算"
}`,
        };
      } else {
        return {
          content: `思考: 这是一个简单的问候，我可以直接回答。
你好！我是 BladeAgent，可以帮助您查询时间和进行数学计算。`,
        };
      }
    },
  };

  // 4. 创建 BladeAgent
  const agent = new BladeAgent({
    llm: mockLLM as any,
    toolkit: simpleToolkit as any,
    maxIterations: 3,
    debug: true,
    systemPrompt: '你是一个智能助手，可以使用工具来帮助用户。',
  });

  // 5. 演示不同场景
  const demos = [
    { question: '现在几点了？', description: '使用 DynamicTool 获取时间' },
    { question: '计算 25 + 17', description: '使用 DynamicStructuredTool 进行数学计算' },
    { question: '你好', description: '直接回答，不使用工具' },
  ];

  for (const demo of demos) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📝 场景: ${demo.description}`);
    console.log(`❓ 问题: "${demo.question}"`);
    console.log(`${'='.repeat(50)}`);

    try {
      const response = await agent.invoke(demo.question);

      console.log(`\n✅ 回答: ${response.content}`);
      console.log(`📊 状态: ${response.status}`);

      if (response.metadata) {
        console.log(
          `📈 元数据: 执行 ${response.metadata.totalSteps} 个步骤，耗时 ${response.metadata.totalTime}ms`
        );
      }
    } catch (error) {
      console.error(`❌ 执行失败:`, error);
    }
  }

  console.log('\n🎉 演示完成！');
  console.log('\n💡 集成要点:');
  console.log('  ✅ 使用 LangChain 内置工具而非自定义实现');
  console.log('  ✅ DynamicTool 适用于简单字符串输入');
  console.log('  ✅ DynamicStructuredTool 适用于复杂对象输入');
  console.log('  ✅ BladeAgent 自动解析 JSON 格式的工具调用');
  console.log('  ✅ 支持工具执行状态跟踪和调试');
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateLangChainToolsIntegration().catch(console.error);
}

export { demonstrateLangChainToolsIntegration };
