#!/usr/bin/env node

/**
 * Blade Agent 测试脚本
 */

import { QwenChatModel } from '../models/QwenChatModel.js';
import { AgentFactory } from './AgentFactory.js';

async function testAgent() {
  console.log('🤖 测试 Blade Agent 系统\n');

  try {
    // 1. 创建语言模型（使用模拟参数）
    console.log('1️⃣ 创建语言模型...');
    const llm = new QwenChatModel({
      apiKey: 'test-key',
      modelName: 'qwen-turbo',
    });
    console.log('✅ 语言模型创建成功');

    // 2. 使用工厂创建 Agent
    console.log('\n2️⃣ 创建 Agent...');
    const agent = AgentFactory.createFromPreset('GENERAL_ASSISTANT', llm, {
      overrides: {
        debug: true,
        maxIterations: 3,
      },
    });
    console.log('✅ Agent 创建成功');

    // 3. 测试 Agent 状态
    console.log('\n3️⃣ Agent 基本信息:');
    console.log(`📊 当前状态: ${agent.getStatus()}`);
    console.log(`📈 统计信息:`, agent.getStats());

    // 4. 测试使用构建器创建 Agent
    console.log('\n4️⃣ 使用构建器创建 Agent...');
    const customAgent = AgentFactory.builder()
      .name('TestAgent')
      .description('测试用 Agent')
      .systemPrompt('你是一个测试助手')
      .llm(llm)
      .maxIterations(5)
      .enableDebug()
      .build();

    console.log('✅ 自定义 Agent 创建成功');
    console.log(`📊 Agent 名称: ${customAgent.getStatus()}`);

    // 5. 测试工具包创建
    console.log('\n5️⃣ 测试专用工具包...');
    const fileToolkit = AgentFactory.createSpecializedToolkit('filesystem');
    console.log(`📁 文件系统工具包: ${fileToolkit.getToolkitStats().totalTools} 个工具`);

    const networkToolkit = AgentFactory.createSpecializedToolkit('network');
    console.log(`🌐 网络工具包: ${networkToolkit.getToolkitStats().totalTools} 个工具`);

    const utilityToolkit = AgentFactory.createSpecializedToolkit('utility');
    console.log(`🔧 实用工具包: ${utilityToolkit.getToolkitStats().totalTools} 个工具`);

    // 6. 测试预设列表
    console.log('\n6️⃣ 可用预设:');
    const presets = AgentFactory.getAvailablePresets();
    presets.forEach(preset => {
      console.log(`  - ${preset.name}: ${preset.config.description}`);
    });

    // 7. 测试配置验证
    console.log('\n7️⃣ 测试配置验证...');
    const validConfig = {
      name: 'ValidAgent',
      llm,
      toolkit: AgentFactory.createDefaultToolkit(),
    };

    const validation = AgentFactory.validateConfig(validConfig);
    console.log(`✅ 配置验证: ${validation.valid ? '通过' : '失败'}`);
    if (!validation.valid) {
      console.log('❌ 错误:', validation.errors);
    }

    // 8. 测试简单对话（模拟）
    console.log('\n8️⃣ 测试简单对话...');
    try {
      // 注意：这里会因为没有真实的API密钥而失败，但可以测试基本流程
      // const response = await agent.invoke('你好，请介绍一下自己');
      console.log('⚠️  跳过实际对话测试（需要真实API密钥）');
    } catch (error) {
      console.log('⚠️  对话测试跳过（预期的API错误）');
    }

    console.log('\n✅ Agent 系统测试完成! 🎉');
    console.log('\n📋 测试结果总结:');
    console.log('  ✅ Agent 创建和配置');
    console.log('  ✅ 工厂模式和构建器模式');
    console.log('  ✅ 工具包专业化');
    console.log('  ✅ 预设管理');
    console.log('  ✅ 配置验证');
    console.log('  ⚠️  实际对话测试（需要API密钥）');
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行测试
testAgent().catch(console.error);
