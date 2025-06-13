#!/usr/bin/env node

/**
 * LangChain 工具系统测试脚本
 */

import { fileSystemTools } from '../../tools/builtin/file-system.js';
import { BladeToolkit } from './BladeToolkit.js';
import { FileReadTool } from './builtin/FileReadTool.js';

async function testTools() {
  console.log('🧪 测试 LangChain 工具系统\n');

  // 1. 创建工具包
  console.log('1️⃣ 创建工具包...');
  const toolkit = new BladeToolkit({
    name: 'TestToolkit',
    description: '测试工具包',
    enableConfirmation: false,
  });

  // 2. 注册新的 LangChain 工具
  console.log('\n2️⃣ 注册新的 LangChain 工具...');
  const fileReadTool = new FileReadTool();
  toolkit.registerTool(fileReadTool);

  // 3. 转换并注册传统工具
  console.log('\n3️⃣ 转换并注册传统工具...');
  try {
    // 获取第一个传统文件系统工具进行测试
    const legacyTools = fileSystemTools.slice(0, 2); // 取前两个工具
    for (const legacyTool of legacyTools) {
      try {
        toolkit.registerLegacyTool(legacyTool, { override: true });
      } catch (error) {
        console.log(`⚠️  转换工具失败 ${legacyTool.name}:`, error.message);
      }
    }
  } catch (error) {
    console.log('⚠️  传统工具转换测试跳过:', error.message);
  }

  // 4. 展示工具包信息
  console.log('\n4️⃣ 工具包信息:');
  console.log(toolkit.listTools());

  // 5. 测试工具执行
  console.log('\n5️⃣ 测试工具执行...');

  try {
    // 测试文件读取工具
    console.log('\n📄 测试文件读取工具...');
    const result = await toolkit.executeTool('file_read', {
      path: 'package.json',
      maxSize: 1024 * 10, // 10KB
    });

    const parsedResult = JSON.parse(result);
    if (parsedResult.path) {
      console.log(`✅ 文件读取成功: ${parsedResult.path}`);
      console.log(`📊 文件大小: ${parsedResult.sizeFormatted}`);
      console.log(`📅 修改时间: ${parsedResult.modified}`);
    } else {
      console.log('❌ 文件读取失败:', result);
    }
  } catch (error) {
    console.log('❌ 工具执行错误:', error.message);
  }

  // 6. 测试工具搜索
  console.log('\n6️⃣ 测试工具搜索...');
  const searchResults = toolkit.searchTools('file');
  console.log(`🔍 搜索 "file" 找到 ${searchResults.length} 个工具:`);
  searchResults.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // 7. 工具包统计
  console.log('\n7️⃣ 工具包统计:');
  const stats = toolkit.getToolkitStats();
  console.log(`📈 总工具数: ${stats.totalTools}`);
  console.log(`📊 分类统计:`, stats.toolsByCategory);
  console.log(`⚠️  风险级别统计:`, stats.toolsByRiskLevel);
  console.log(`⏱️  平均执行时间: ${stats.averageExecutionTime.toFixed(2)}ms`);

  // 8. 转换为 LangChain Tools
  console.log('\n8️⃣ 转换为 LangChain Tools...');
  const langchainTools = toolkit.toLangChainTools();
  console.log(`🔗 可用于 LangChain 的工具数量: ${langchainTools.length}`);
  langchainTools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  console.log('\n✅ 测试完成!');
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testTools().catch(console.error);
}
