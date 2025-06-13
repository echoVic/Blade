/**
 * 模型测试脚本 - 验证 LangChain 模型实现
 */

import { HumanMessage } from '@langchain/core/messages';
import { modelFactory } from './ModelFactory.js';
import type { QwenModelConfig, VolcEngineModelConfig } from './types.js';

/**
 * 测试千问模型
 */
async function testQwenModel() {
  console.log('\n🧪 测试千问模型...');

  try {
    const config: QwenModelConfig = {
      apiKey: process.env.QWEN_API_KEY || 'test-key',
      model: 'qwen-plus-2025-04-28',
      temperature: 0.7,
    };

    const model = modelFactory.createQwenModel(config);
    console.log('✅ 千问模型创建成功');
    console.log(`📋 模型类型: ${model._llmType()}`);

    // 测试连接（如果有真实API Key）
    if (process.env.QWEN_API_KEY) {
      const isConnected = await model.testConnection();
      console.log(`🔗 连接测试: ${isConnected ? '成功' : '失败'}`);

      if (isConnected) {
        // 测试简单对话
        const response = await model.invoke([new HumanMessage('你好，请简单介绍一下自己')]);
        console.log(`💬 对话测试: ${response.content.slice(0, 100)}...`);
      }
    } else {
      console.log('⚠️  未提供 QWEN_API_KEY，跳过连接测试');
    }
  } catch (error) {
    console.error('❌ 千问模型测试失败:', error);
  }
}

/**
 * 测试火山引擎模型
 */
async function testVolcEngineModel() {
  console.log('\n🧪 测试火山引擎模型...');

  try {
    const config: VolcEngineModelConfig = {
      apiKey: process.env.VOLCENGINE_API_KEY || 'test-key',
      model: 'ep-20250417144747-rgffm',
      temperature: 0.7,
    };

    const model = modelFactory.createVolcEngineModel(config);
    console.log('✅ 火山引擎模型创建成功');
    console.log(`📋 模型类型: ${model._llmType()}`);

    // 测试连接（如果有真实API Key）
    if (process.env.VOLCENGINE_API_KEY) {
      const isConnected = await model.testConnection();
      console.log(`🔗 连接测试: ${isConnected ? '成功' : '失败'}`);

      if (isConnected) {
        // 测试简单对话
        const response = await model.invoke([new HumanMessage('你好，请简单介绍一下自己')]);
        console.log(`💬 对话测试: ${response.content.slice(0, 100)}...`);
      }
    } else {
      console.log('⚠️  未提供 VOLCENGINE_API_KEY，跳过连接测试');
    }
  } catch (error) {
    console.error('❌ 火山引擎模型测试失败:', error);
  }
}

/**
 * 测试模型工厂
 */
async function testModelFactory() {
  console.log('\n🧪 测试模型工厂...');

  try {
    // 测试支持的提供商
    const providers = modelFactory.getSupportedProviders();
    console.log(`✅ 支持的提供商: ${providers.join(', ')}`);

    // 测试提供商检查
    console.log(`✅ qwen 支持: ${modelFactory.isProviderSupported('qwen')}`);
    console.log(`✅ volcengine 支持: ${modelFactory.isProviderSupported('volcengine')}`);
    console.log(`❌ openai 支持: ${modelFactory.isProviderSupported('openai')}`);

    // 测试配置验证
    const validConfig = {
      provider: 'qwen' as const,
      config: {
        apiKey: 'test-key',
        model: 'qwen-plus-2025-04-28',
      },
    };

    const invalidConfig = {
      provider: 'qwen' as const,
      config: {
        apiKey: '',
        model: 'qwen-plus-2025-04-28',
      },
    };

    console.log(`✅ 有效配置验证: ${modelFactory.validateConfig(validConfig)}`);
    console.log(`❌ 无效配置验证: ${modelFactory.validateConfig(invalidConfig)}`);
  } catch (error) {
    console.error('❌ 模型工厂测试失败:', error);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始 LangChain 模型层测试');
  console.log('=====================================');

  await testModelFactory();
  await testQwenModel();
  await testVolcEngineModel();

  console.log('\n🎉 测试完成');
  console.log('=====================================');
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, testModelFactory, testQwenModel, testVolcEngineModel };
