#!/usr/bin/env tsx

/**
 * 工具系统使用示例
 * 演示如何使用工具管理器和各种内置工具
 */

import { createToolManager, type ToolDefinition } from '../src/tools/index.js';

/**
 * 基础使用示例
 */
async function basicExample() {
  console.log('=== 基础使用示例 ===\n');

  // 创建工具管理器
  const toolManager = await createToolManager({
    debug: true,
    maxConcurrency: 5,
  });

  // 获取所有工具
  const tools = toolManager.getTools();
  console.log(`已加载 ${tools.length} 个工具\n`);

  // 按分类显示工具
  const categories = tools.reduce(
    (acc, tool) => {
      const category = tool.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tool.name);
      return acc;
    },
    {} as Record<string, string[]>
  );

  for (const [category, toolNames] of Object.entries(categories)) {
    console.log(`${category}: ${toolNames.join(', ')}`);
  }
  console.log('');
}

/**
 * 文本处理工具示例
 */
async function textProcessingExample() {
  console.log('=== 文本处理工具示例 ===\n');

  const toolManager = await createToolManager();

  // 文本长度统计
  console.log('1. 文本长度统计:');
  const lengthResult = await toolManager.callTool({
    toolName: 'text_length',
    parameters: {
      text: 'Hello, 世界！This is a test string.\nSecond line.',
      countType: 'all',
    },
  });
  console.log('结果:', JSON.stringify(lengthResult.result.data, null, 2));
  console.log('');

  // 文本格式化
  console.log('2. 文本格式化:');
  const formatResult = await toolManager.callTool({
    toolName: 'text_format',
    parameters: {
      text: '  hello world  ',
      operation: 'trim',
    },
  });
  console.log('结果:', JSON.stringify(formatResult.result.data, null, 2));
  console.log('');

  // 文本搜索
  console.log('3. 文本搜索:');
  const searchResult = await toolManager.callTool({
    toolName: 'text_search',
    parameters: {
      text: 'The quick brown fox jumps over the lazy dog.',
      pattern: 'o',
      caseSensitive: false,
    },
  });
  console.log('结果:', JSON.stringify(searchResult.result.data, null, 2));
  console.log('');
}

/**
 * 实用工具示例
 */
async function utilityToolsExample() {
  console.log('=== 实用工具示例 ===\n');

  const toolManager = await createToolManager();

  // 时间戳工具
  console.log('1. 获取当前时间戳:');
  const timestampResult = await toolManager.callTool({
    toolName: 'timestamp',
    parameters: {
      operation: 'now',
      format: 'iso',
    },
  });
  console.log('结果:', JSON.stringify(timestampResult.result.data, null, 2));
  console.log('');

  // UUID 生成
  console.log('2. 生成 UUID:');
  const uuidResult = await toolManager.callTool({
    toolName: 'uuid',
    parameters: {
      count: 3,
    },
  });
  console.log('结果:', JSON.stringify(uuidResult.result.data, null, 2));
  console.log('');

  // 随机数生成
  console.log('3. 生成随机数:');
  const randomResult = await toolManager.callTool({
    toolName: 'random',
    parameters: {
      type: 'number',
      min: 1,
      max: 100,
      count: 5,
    },
  });
  console.log('结果:', JSON.stringify(randomResult.result.data, null, 2));
  console.log('');

  // Base64 编码
  console.log('4. Base64 编码:');
  const base64Result = await toolManager.callTool({
    toolName: 'base64',
    parameters: {
      operation: 'encode',
      input: 'Hello, 世界！',
    },
  });
  console.log('结果:', JSON.stringify(base64Result.result.data, null, 2));
  console.log('');
}

/**
 * 网络工具示例
 */
async function networkToolsExample() {
  console.log('=== 网络工具示例 ===\n');

  const toolManager = await createToolManager();

  // URL 解析
  console.log('1. URL 解析:');
  const urlParseResult = await toolManager.callTool({
    toolName: 'url_parse',
    parameters: {
      url: 'https://api.example.com:8080/v1/users?page=1&limit=10#section1',
    },
  });
  console.log('结果:', JSON.stringify(urlParseResult.result.data, null, 2));
  console.log('');

  // URL 构建
  console.log('2. URL 构建:');
  const urlBuildResult = await toolManager.callTool({
    toolName: 'url_build',
    parameters: {
      protocol: 'https',
      hostname: 'api.example.com',
      port: 443,
      pathname: '/v1/users',
      queryParams: {
        page: 1,
        limit: 10,
      },
      hash: 'results',
    },
  });
  console.log('结果:', JSON.stringify(urlBuildResult.result.data, null, 2));
  console.log('');

  // JSON 格式化
  console.log('3. JSON 格式化:');
  const jsonFormatResult = await toolManager.callTool({
    toolName: 'json_format',
    parameters: {
      input: '{"name":"John","age":30,"city":"New York"}',
      operation: 'format',
      indent: 2,
    },
  });
  console.log('结果:', JSON.stringify(jsonFormatResult.result.data, null, 2));
  console.log('');
}

/**
 * 自定义工具示例
 */
async function customToolExample() {
  console.log('=== 自定义工具示例 ===\n');

  const toolManager = await createToolManager();

  // 定义自定义工具
  const calculatorTool: ToolDefinition = {
    name: 'calculator',
    description: '简单计算器',
    version: '1.0.0',
    category: 'math',
    tags: ['math', 'calculator'],
    parameters: {
      operation: {
        type: 'string',
        description: '数学运算',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        required: true,
      },
      a: {
        type: 'number',
        description: '第一个数字',
        required: true,
      },
      b: {
        type: 'number',
        description: '第二个数字',
        required: true,
      },
    },
    required: ['operation', 'a', 'b'],
    async execute(params) {
      const { operation, a, b } = params;

      try {
        let result: number;

        switch (operation) {
          case 'add':
            result = a + b;
            break;
          case 'subtract':
            result = a - b;
            break;
          case 'multiply':
            result = a * b;
            break;
          case 'divide':
            if (b === 0) {
              return {
                success: false,
                error: '除数不能为零',
              };
            }
            result = a / b;
            break;
          default:
            return {
              success: false,
              error: `不支持的运算: ${operation}`,
            };
        }

        return {
          success: true,
          data: {
            operation,
            operands: [a, b],
            result,
            expression: `${a} ${operation} ${b} = ${result}`,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  };

  // 注册自定义工具
  await toolManager.registerTool(calculatorTool);
  console.log('自定义计算器工具已注册\n');

  // 使用自定义工具
  console.log('计算 15 + 27:');
  const calcResult = await toolManager.callTool({
    toolName: 'calculator',
    parameters: {
      operation: 'add',
      a: 15,
      b: 27,
    },
  });
  console.log('结果:', JSON.stringify(calcResult.result.data, null, 2));
  console.log('');
}

/**
 * 工具统计示例
 */
async function statsExample() {
  console.log('=== 工具统计示例 ===\n');

  const toolManager = await createToolManager();

  // 执行一些工具调用以产生统计数据
  await toolManager.callTool({
    toolName: 'uuid',
    parameters: { count: 1 },
  });

  await toolManager.callTool({
    toolName: 'timestamp',
    parameters: { operation: 'now' },
  });

  // 获取统计信息
  const stats = toolManager.getStats();
  console.log('工具统计信息:');
  console.log(JSON.stringify(stats, null, 2));
  console.log('');

  // 获取执行历史
  const history = toolManager.getExecutionHistory(5);
  console.log('最近执行历史:');
  history.forEach((record, index) => {
    console.log(
      `${index + 1}. ${record.toolName} - ${record.result.success ? '成功' : '失败'} (${record.result.duration}ms)`
    );
  });
  console.log('');
}

/**
 * 主函数
 */
async function main() {
  try {
    await basicExample();
    await textProcessingExample();
    await utilityToolsExample();
    await networkToolsExample();
    await customToolExample();
    await statsExample();

    console.log('✅ 所有示例执行完成！');
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  }
}

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
 