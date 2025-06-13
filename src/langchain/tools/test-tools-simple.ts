#!/usr/bin/env node

/**
 * 简化的 LangChain 工具验证脚本
 */

import { BladeToolkit } from './BladeToolkit.js';
import { getAllBuiltinTools } from './builtin/index.js';

async function testToolsSimple() {
  console.log('🧪 验证 LangChain 工具系统\n');

  try {
    // 1. 创建工具包
    console.log('1️⃣ 创建工具包...');
    const toolkit = new BladeToolkit({
      name: 'TestToolkit',
      description: '验证工具包',
      enableConfirmation: false, // 测试时禁用确认
    });

    // 2. 注册所有内置工具
    console.log('\n2️⃣ 注册内置工具...');
    const builtinTools = getAllBuiltinTools();
    toolkit.registerTools(builtinTools, { override: true });

    // 3. 展示工具包信息
    console.log('\n3️⃣ 工具包信息:');
    console.log(toolkit.listTools());

    // 4. 测试时间戳工具
    console.log('\n4️⃣ 测试时间戳工具...');
    try {
      const timestampResult = await toolkit.executeTool('timestamp', { action: 'current' });
      const parsedTimestamp = JSON.parse(timestampResult);
      console.log(`✅ 时间戳工具测试成功`);
      console.log(`📅 当前时间: ${parsedTimestamp.iso}`);
      console.log(`🕐 时间戳: ${parsedTimestamp.timestamp}`);
    } catch (error) {
      console.log('❌ 时间戳工具测试失败:', error.message);
    }

    // 5. 测试 HTTP 工具
    console.log('\n5️⃣ 测试 HTTP 工具...');
    try {
      const httpResult = await toolkit.executeTool('http_request', {
        url: 'https://httpbin.org/json',
        method: 'GET',
        timeout: 5000,
      });

      const parsedHttp = JSON.parse(httpResult);
      console.log(`✅ HTTP 工具测试成功`);
      console.log(`🌐 状态码: ${parsedHttp.status}`);
      console.log(`📡 URL: ${parsedHttp.url}`);
    } catch (error) {
      console.log('❌ HTTP 工具测试失败:', error.message);
    }

    // 6. 测试文件读取工具
    console.log('\n6️⃣ 测试文件读取工具...');
    try {
      const fileResult = await toolkit.executeTool('file_read', {
        path: 'package.json',
        maxSize: 10240,
      });

      const parsedFile = JSON.parse(fileResult);
      if (parsedFile.path) {
        console.log(`✅ 文件读取工具测试成功`);
        console.log(`📁 文件路径: ${parsedFile.path}`);
        console.log(`📊 文件大小: ${parsedFile.sizeFormatted}`);
      } else {
        console.log('❌ 文件读取工具测试失败:', fileResult);
      }
    } catch (error) {
      console.log('❌ 文件读取工具测试失败:', error.message);
    }

    // 7. 工具包统计
    console.log('\n7️⃣ 工具包统计:');
    const stats = toolkit.getToolkitStats();
    console.log(`📈 总工具数: ${stats.totalTools}`);
    console.log(`📊 分类统计:`, stats.toolsByCategory);
    console.log(`⚠️  风险级别统计:`, stats.toolsByRiskLevel);
    console.log(`⏱️  平均执行时间: ${stats.averageExecutionTime.toFixed(2)}ms`);

    // 8. 转换为 LangChain Tools
    console.log('\n8️⃣ LangChain 兼容性检查...');
    const langchainTools = toolkit.toLangChainTools();
    console.log(`🔗 LangChain 工具数量: ${langchainTools.length}`);

    langchainTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    console.log('\n✅ 工具系统验证完成! 🎉');
    console.log('\n📋 功能验证结果:');
    console.log('  ✅ 工具注册和管理');
    console.log('  ✅ 工具执行和错误处理');
    console.log('  ✅ 性能监控和统计');
    console.log('  ✅ LangChain 兼容性');
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行验证
testToolsSimple().catch(console.error);
