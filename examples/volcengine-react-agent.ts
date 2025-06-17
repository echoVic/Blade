/**
 * 豆包模型 ReAct Agent 集成示例
 *
 * 本示例演示了如何使用 BladeAgent 的智能模型选择功能：
 * - 豆包模型：自动使用 LangChain 原生 ReAct Agent
 * - 通义千问：自动使用简化工具调用模式
 * - 智能策略选择和自动回退机制
 */

import 'dotenv/config';
import { AgentFactory } from '../src/langchain/agents/AgentFactory.js';

/**
 * 🎯 豆包 ReAct Agent 演示
 */
async function volcEngineReactDemo() {
  console.log('🚀 豆包模型 ReAct Agent 演示');
  console.log('='.repeat(50));

  try {
    // 1. 使用智能 Agent 工厂创建推荐 Agent
    console.log('\n📦 步骤 1: 创建智能 Agent');
    const agent = AgentFactory.createRecommendedAgent('GENERAL_ASSISTANT', {
      preferredProvider: 'volcengine', // 优先使用豆包模型
    });

    // 2. 简单任务测试
    console.log('\n🧪 步骤 2: 简单任务测试');
    const result1 = await agent.invoke('你好，请介绍一下你自己');
    console.log('✅ 响应:', result1.content);
    console.log('📊 执行策略:', result1.metadata?.executionStrategy);
    console.log('🏷️ 模型类型:', result1.metadata?.modelType);

    // 3. 工具调用测试
    console.log('\n🔧 步骤 3: 工具调用测试');
    const result2 = await agent.invoke('请读取 package.json 文件');
    console.log('✅ 响应:', result2.content.substring(0, 200) + '...');
    console.log('📊 执行策略:', result2.metadata?.executionStrategy);
    console.log('🛠️ 中间步骤数:', result2.metadata?.intermediateSteps?.length || 0);

    // 4. 复杂推理任务测试
    console.log('\n🧠 步骤 4: 复杂推理任务测试');
    const result3 = await agent.invoke(`
      请分析一下这个项目的技术栈：
      1. 读取 package.json 文件
      2. 分析依赖项
      3. 总结主要的技术特点
    `);
    console.log('✅ 响应:', result3.content.substring(0, 300) + '...');
    console.log('📊 执行策略:', result3.metadata?.executionStrategy);

    // 5. 流式输出测试
    console.log('\n📡 步骤 5: 流式输出测试');
    console.log('开始流式处理...');
    let stepCount = 0;
    for await (const chunk of agent.stream('请简单介绍一下 TypeScript 的特点')) {
      stepCount++;
      console.log(`🔄 流式步骤 ${stepCount}:`, chunk.type, '-', chunk.content.substring(0, 100));
      if (chunk.type === 'final') break;
    }
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  }
}

/**
 * 🔄 对比演示：豆包 vs 通义千问
 */
async function comparisonDemo() {
  console.log('\n🔄 对比演示：豆包 vs 通义千问');
  console.log('='.repeat(50));

  const testQuery = '请读取 package.json 并总结项目信息';

  try {
    // 豆包模型测试
    if (process.env.VOLCENGINE_API_KEY) {
      console.log('\n🚀 豆包模型测试 (ReAct 模式):');
      const volcAgent = AgentFactory.createVolcEngineAgent('GENERAL_ASSISTANT');
      const volcResult = await volcAgent.invoke(testQuery);
      console.log('✅ 执行策略:', volcResult.metadata?.executionStrategy);
      console.log('⏱️ 执行时间:', volcResult.metadata?.totalTime, 'ms');
      console.log('🛠️ 中间步骤:', volcResult.metadata?.intermediateSteps?.length || 0);
    }

    // 通义千问测试
    if (process.env.QWEN_API_KEY) {
      console.log('\n🤖 通义千问测试 (简化模式):');
      const qwenAgent = AgentFactory.createQwenAgent('GENERAL_ASSISTANT');
      const qwenResult = await qwenAgent.invoke(testQuery);
      console.log('✅ 执行策略:', qwenResult.metadata?.executionStrategy);
      console.log('⏱️ 执行时间:', qwenResult.metadata?.totalTime, 'ms');
      console.log('🛠️ 中间步骤:', qwenResult.metadata?.intermediateSteps?.length || 0);
    }
  } catch (error) {
    console.error('❌ 对比演示中发生错误:', error);
  }
}

/**
 * 📈 性能对比测试
 */
async function performanceTest() {
  console.log('\n📈 性能对比测试');
  console.log('='.repeat(50));

  const testCases = [
    '你好',
    '请读取 README.md 文件',
    '分析项目的依赖结构',
    '总结这个 AI Agent 项目的特点',
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 测试用例: ${testCase}`);

    try {
      const agent = AgentFactory.createRecommendedAgent('GENERAL_ASSISTANT');
      const startTime = Date.now();
      const result = await agent.invoke(testCase);
      const endTime = Date.now();

      console.log(`⏱️ 执行时间: ${endTime - startTime}ms`);
      console.log(`📊 执行策略: ${result.metadata?.executionStrategy}`);
      console.log(`🎯 结果长度: ${result.content.length} 字符`);
      console.log(`✅ 状态: ${result.status}`);
    } catch (error) {
      console.error(`❌ 测试失败:`, error);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🎯 Blade AI - 豆包模型 ReAct Agent 集成演示');
  console.log('='.repeat(60));

  // 检查环境变量
  const hasVolcEngine = !!process.env.VOLCENGINE_API_KEY;
  const hasQwen = !!process.env.QWEN_API_KEY;

  console.log('\n🔍 环境检查:');
  console.log(`  - 豆包 API: ${hasVolcEngine ? '✅ 可用' : '❌ 未配置'}`);
  console.log(`  - 通义千问 API: ${hasQwen ? '✅ 可用' : '❌ 未配置'}`);

  if (!hasVolcEngine && !hasQwen) {
    console.error('\n❌ 错误: 未找到任何可用的 API 密钥');
    console.log('请在 .env 文件中设置 VOLCENGINE_API_KEY 或 QWEN_API_KEY');
    return;
  }

  // 运行演示
  await volcEngineReactDemo();
  await comparisonDemo();
  await performanceTest();

  console.log('\n🎉 演示完成！');
  console.log('\n💡 总结:');
  console.log('  - ✅ 豆包模型支持 LangChain 原生 ReAct Agent');
  console.log('  - ✅ 通义千问使用简化工具调用模式保证兼容性');
  console.log('  - ✅ 智能策略选择，自动回退机制');
  console.log('  - ✅ 完整的事件驱动架构和统计信息');
}

// 运行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { comparisonDemo, performanceTest, volcEngineReactDemo };
