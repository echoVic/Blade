/**
 * 新Agent架构使用示例
 * 展示如何使用基于Claude Code设计的智能Agent系统
 */

import { AgentTool, createMainAgent } from '../agent/index.js';
import type { BladeConfig } from '../config/types/index.js';

/**
 * 基础使用示例
 */
export async function basicExample() {
  console.log('=== 基础Agent使用示例 ===');

  const config: BladeConfig = {
    apiKey: 'your-api-key',
    baseUrl: 'https://apis.iflow.cn/v1',
    modelName: 'Qwen3-Coder',
  };

  // 创建主Agent
  const agent = await createMainAgent(config);

  try {
    // 1. 简单聊天
    console.log('\n1. 简单聊天:');
    const chatResponse = await agent.chat('你好，请介绍一下你的能力');
    console.log('回答:', chatResponse);

    // 2. 系统提示词聊天
    console.log('\n2. 系统提示词聊天:');
    const systemResponse = await agent.chatWithSystem(
      '你是一个TypeScript专家',
      '请解释interface和type的区别'
    );
    console.log('回答:', systemResponse);

    // 3. 复杂任务执行
    console.log('\n3. 复杂任务执行:');
    const complexTask = {
      id: 'complex-task-1',
      type: 'complex' as const,
      prompt: '请分析当前项目的架构，并提供一个React组件的实现示例',
      context: {
        projectType: 'react-typescript',
        requirements: ['响应式设计', '类型安全', '性能优化'],
      },
    };

    const taskResponse = await agent.executeTask(complexTask);
    console.log('任务结果:', taskResponse.content);
    console.log('执行计划:', taskResponse.executionPlan);
    console.log('子Agent结果:', taskResponse.subAgentResults);
  } finally {
    await agent.destroy();
  }
}

/**
 * Agent工具使用示例
 */
export async function agentToolExample() {
  console.log('\n=== Agent工具使用示例 ===');

  const config: BladeConfig = {
    apiKey: 'your-api-key',
    baseUrl: 'https://apis.iflow.cn/v1',
    modelName: 'Qwen3-Coder',
  };

  const agent = await createMainAgent(config);
  const agentTool = new AgentTool(agent);

  try {
    // 1. 调用代码专家Agent
    console.log('\n1. 调用代码专家Agent:');
    const codeResult = await agentTool.execute({
      agentName: 'code-agent',
      taskType: 'code',
      prompt: '实现一个TypeScript的深拷贝函数，要求支持循环引用检测',
      options: {
        temperature: 0.1,
        maxTokens: 2048,
      },
    });

    if (codeResult.success) {
      console.log('代码生成成功:', codeResult.content);
      console.log('执行时间:', codeResult.executionTime + 'ms');
    } else {
      console.log('代码生成失败:', codeResult.error);
    }

    // 2. 调用分析专家Agent
    console.log('\n2. 调用分析专家Agent:');
    const analysisResult = await agentTool.execute({
      agentName: 'analysis-agent',
      taskType: 'analysis',
      prompt:
        '分析以下代码的性能瓶颈并提供优化建议:\n\n```typescript\nfor (let i = 0; i < data.length; i++) {\n  for (let j = 0; j < data[i].length; j++) {\n    result.push(expensiveOperation(data[i][j]));\n  }\n}\n```',
    });

    if (analysisResult.success) {
      console.log('分析结果:', analysisResult.content);
    }

    // 3. 获取可用Agent列表
    console.log('\n3. 可用Agent列表:');
    const availableAgents = agentTool.getAvailableAgents();
    console.log('可用Agent:', availableAgents);

    // 4. 获取Agent推荐
    console.log('\n4. Agent推荐:');
    const recommendation = agentTool.recommendAgent('我需要写一些单元测试');
    if (recommendation) {
      console.log(`推荐Agent: ${recommendation.agentName}`);
      console.log(`置信度: ${recommendation.confidence}`);
      console.log(`推荐理由: ${recommendation.reason}`);
    }
  } finally {
    await agent.destroy();
  }
}

/**
 * 上下文管理示例
 */
export async function contextManagementExample() {
  console.log('\n=== 上下文管理示例 ===');

  const config: BladeConfig = {
    apiKey: 'your-api-key',
    baseUrl: 'https://apis.iflow.cn/v1',
    modelName: 'Qwen3-Coder',
  };

  const agent = await createMainAgent(config);
  // const contextManager = agent.getContextManager();

  try {
    // TODO: 实现上下文管理示例
    console.log('上下文管理功能开发中...');

    // 1. 创建会话
    // const sessionId = contextManager.createSession();

    // 2. 多轮对话
    // const messages = [
    //   { role: 'user', content: '请帮我设计一个用户管理系统' },
    //   { role: 'assistant', content: '我来帮你设计...' },
    //   { role: 'user', content: '需要支持角色权限管理' }
    // ];
    // const response = await contextManager.processConversation(messages, sessionId);

    // 3. 查看会话统计
    // const stats = contextManager.getStats();
    // console.log('上下文统计:', stats);
  } finally {
    await agent.destroy();
  }
}

/**
 * 向后兼容示例
 */
export async function backwardCompatibilityExample() {
  console.log('\n=== 向后兼容示例 ===');

  // 仍然可以使用旧的Agent类
  const { createAgent } = await import('../agent/index.js');

  const oldAgent = await createAgent({
    apiKey: 'your-api-key',
    baseUrl: 'https://apis.iflow.cn/v1',
    modelName: 'Qwen3-Coder',
  });

  try {
    const response = await oldAgent.chat('你好');
    console.log('旧Agent响应:', response);
  } finally {
    await oldAgent.destroy();
  }
}

/**
 * 性能对比示例
 */
export async function performanceComparisonExample() {
  console.log('\n=== 性能对比示例 ===');

  const config: BladeConfig = {
    apiKey: 'your-api-key',
    baseUrl: 'https://apis.iflow.cn/v1',
    modelName: 'Qwen3-Coder',
  };

  // 创建新旧两种Agent
  const { createAgent } = await import('../agent/index.js');
  const oldAgent = await createAgent(config);
  const newAgent = await createMainAgent(config);

  const testPrompt = '请实现一个React Hook来管理本地存储，包括类型安全和错误处理';

  try {
    // 测试旧Agent
    console.log('\n测试旧Agent:');
    const oldStart = Date.now();
    const oldResponse = await oldAgent.chat(testPrompt);
    const oldTime = Date.now() - oldStart;
    console.log(`旧Agent响应时间: ${oldTime}ms`);
    console.log('旧Agent响应长度:', oldResponse.length);

    // 测试新Agent
    console.log('\n测试新Agent:');
    const newStart = Date.now();
    const newResponse = await newAgent.chat(testPrompt);
    const newTime = Date.now() - newStart;
    console.log(`新Agent响应时间: ${newTime}ms`);
    console.log('新Agent响应长度:', newResponse.length);

    // 性能对比
    console.log('\n性能对比:');
    console.log(`时间差异: ${(((newTime - oldTime) / oldTime) * 100).toFixed(2)}%`);
    console.log(
      `内容长度差异: ${(((newResponse.length - oldResponse.length) / oldResponse.length) * 100).toFixed(2)}%`
    );
  } finally {
    await oldAgent.destroy();
    await newAgent.destroy();
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  try {
    await basicExample();
    await agentToolExample();
    await contextManagementExample();
    await backwardCompatibilityExample();
    await performanceComparisonExample();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
