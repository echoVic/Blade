#!/usr/bin/env tsx

/**
 * LangChain Memory 完整演示
 * 展示如何充分利用 LangChain 的强大记忆能力
 */

import { BladeChains } from './src/langchain/chains/BladeChains.js';
import { ChainContext } from './src/langchain/chains/types.js';
import { LangChainMemoryManager, MemoryType } from './src/langchain/memory/index.js';
import { FileReadTool } from './src/langchain/tools/builtin/FileReadTool.js';
import { UuidTool } from './src/langchain/tools/builtin/UuidTool.js';

console.log('🚀 LangChain Memory 完整演示\n');

// 1. Buffer Memory - 完整对话历史
console.log('🧠 演示 1: Buffer Memory - 完整对话记录');
const bufferMemory = new LangChainMemoryManager({
  type: 'buffer',
});

await bufferMemory.createSession('chat-session-001', 'user-alice');

// 模拟多轮对话
await bufferMemory.remember('chat-session-001', MemoryType.CONVERSATION, {
  role: 'user',
  message: '你好，我是 Alice，我是一名软件工程师',
});

await bufferMemory.remember('chat-session-001', MemoryType.CONVERSATION, {
  role: 'assistant',
  message: '你好 Alice！很高兴认识你，软件工程师是个很棒的职业',
});

await bufferMemory.remember('chat-session-001', MemoryType.CONVERSATION, {
  role: 'user',
  message: '我正在学习 TypeScript 和 LangChain',
});

// 获取记忆
const bufferVars = await bufferMemory.getMemoryVariables('chat-session-001');
console.log('✅ Buffer Memory 对话历史长度:', bufferVars.chat_history?.length || 0);

const conversations = await bufferMemory.recall(
  'chat-session-001',
  undefined,
  MemoryType.CONVERSATION
);
console.log('✅ 对话记录数:', conversations.length);
console.log('✅ 最后一条对话:', conversations[conversations.length - 1]?.content.message);

// 2. Window Memory - 滑动窗口记忆
console.log('\n🪟 演示 2: Window Memory - 滑动窗口记忆');
const windowMemory = new LangChainMemoryManager({
  type: 'window',
  options: { k: 2 }, // 只保留最近2条
});

await windowMemory.createSession('window-session');

// 添加多条消息
for (let i = 1; i <= 4; i++) {
  await windowMemory.remember('window-session', MemoryType.CONVERSATION, {
    role: i % 2 === 1 ? 'user' : 'assistant',
    message: `消息 ${i}: ${i % 2 === 1 ? '用户提问' : 'AI回复'}`,
  });
}

const windowStats = await windowMemory.getStats('window-session');
console.log('✅ Window Memory 总记录数:', windowStats.totalEntries);
console.log('✅ 滑动窗口策略有效控制了记忆大小');

// 3. Chains + Memory 集成
console.log('\n⛓️ 演示 3: Chains + LangChain Memory 深度集成');

const chainsMemory = new LangChainMemoryManager({
  type: 'buffer',
});

const chains = new BladeChains();
chains.registerTool('uuid', new UuidTool());
chains.registerTool('file-read', new FileReadTool());
chains.setMemory(chainsMemory);

// 创建智能链
const smartChain = BladeChains.createBuilder()
  .prompt('基于历史对话{{memory_context}}，为用户{{user_name}}生成UUID', {
    variables: { user_name: 'Alice' },
  })
  .tool('gen-uuid', {
    toolName: 'uuid',
    parameters: { count: 1 },
  })
  .build();

smartChain.id = 'smart-memory-chain';
smartChain.name = '智能记忆链';

await chains.register(smartChain);

// 执行链
const context: ChainContext = {
  executionId: 'memory-demo-exec',
  sessionId: 'smart-session',
  timestamp: new Date(),
  userId: 'alice',
};

const result = await chains.execute(smartChain.id, { user_name: 'Alice' }, context);
console.log('✅ 智能链执行结果:', result.success ? '成功' : '失败');

if (result.finalOutput) {
  console.log('✅ 生成的 UUID:', result.finalOutput);
}

// 检查记忆存储
const memoryEntries = await chainsMemory.recall(context.sessionId!);
console.log('✅ 链执行后存储的记忆数:', memoryEntries.length);

// 分类显示记忆
const byType = memoryEntries.reduce(
  (acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);
console.log('✅ 记忆类型分布:', byType);

// 4. 记忆搜索和检索
console.log('\n🔍 演示 4: 记忆搜索和检索能力');

// 添加更多结构化记忆
await chainsMemory.remember(
  context.sessionId!,
  MemoryType.USER_PROFILE,
  {
    name: 'Alice',
    profession: '软件工程师',
    interests: ['TypeScript', 'LangChain', 'AI'],
    level: 'intermediate',
  },
  { source: 'user_input' }
);

await chainsMemory.remember(
  context.sessionId!,
  MemoryType.PREFERENCE,
  {
    language: 'Chinese',
    communication_style: 'detailed',
    preferred_examples: 'code_snippets',
  },
  { category: 'ui_preferences' }
);

await chainsMemory.remember(
  context.sessionId!,
  MemoryType.CONTEXT,
  {
    current_task: 'learning_langchain',
    session_goal: 'understand_memory_system',
    progress: 'advanced',
  },
  { priority: 'high' }
);

// 搜索特定类型的记忆
const profileMemories = await chainsMemory.recall(
  context.sessionId!,
  undefined,
  MemoryType.USER_PROFILE
);
const preferenceMemories = await chainsMemory.recall(
  context.sessionId!,
  undefined,
  MemoryType.PREFERENCE
);
const contextMemories = await chainsMemory.recall(
  context.sessionId!,
  undefined,
  MemoryType.CONTEXT
);

console.log('✅ 用户档案记忆:', profileMemories.length, '条');
console.log('✅ 用户偏好记忆:', preferenceMemories.length, '条');
console.log('✅ 上下文记忆:', contextMemories.length, '条');

// 关键词搜索
const searchResults = await chainsMemory.recall(context.sessionId!, 'TypeScript');
console.log('✅ "TypeScript" 搜索结果:', searchResults.length, '条');

// 5. LangChain 原生功能展示
console.log('\n🔗 演示 5: LangChain 原生功能');

// 使用 LangChain 原生方法保存上下文
await chainsMemory.saveContext(
  context.sessionId!,
  { human: '请解释什么是 LangChain Memory？' },
  { ai: 'LangChain Memory 是一个强大的记忆管理系统，支持多种记忆策略...' }
);

// 获取 LangChain 原生 memory 实例
const nativeMemory = await chainsMemory.getMemoryInstance(context.sessionId!);
console.log('✅ LangChain Memory 实例类型:', nativeMemory.constructor.name);

// 获取原生 memory 变量
const nativeVars = await chainsMemory.getMemoryVariables(context.sessionId!, {
  question: '当前对话的主题是什么？',
});
console.log('✅ LangChain 原生变量:', Object.keys(nativeVars));

// 6. 综合统计和分析
console.log('\n📊 演示 6: 综合统计和分析');

const finalStats = await chainsMemory.getStats(context.sessionId!);
console.log('📈 最终统计信息:');
console.log('  📝 总记忆条目:', finalStats.totalEntries);
console.log('  💾 总内存大小:', finalStats.totalSize, '字符');
console.log('  🔢 平均重要性:', finalStats.averageImportance?.toFixed(2));
console.log('  📅 最早记忆:', finalStats.oldestEntry?.toLocaleString());
console.log('  🕐 最新记忆:', finalStats.newestEntry?.toLocaleString());

console.log('\n📈 记忆类型分布:');
Object.entries(finalStats.entriesByType).forEach(([type, count]) => {
  if (count > 0) {
    console.log(`  ${type}: ${count} 条`);
  }
});

// 7. 会话摘要
console.log('\n📝 演示 7: 智能会话摘要');
const summary = await chainsMemory.summarize(context.sessionId!, 10);
console.log('✅ 会话摘要:');
console.log(summary);

console.log('\n🎉 LangChain Memory 演示完成！');
console.log('\n💡 LangChain Memory 的核心优势：');
console.log('  🧠 丰富的记忆类型支持');
console.log('  🔄 灵活的记忆策略');
console.log('  🔍 强大的搜索和检索');
console.log('  ⛓️ 与 Chains 的深度集成');
console.log('  🎯 LangChain 生态兼容');
console.log('  📊 完整的统计分析');
console.log('  🚀 生产环境就绪');

console.log('\n✨ 这就是为什么我们选择 LangChain Memory 的原因！');
console.log('   它提供了工业级的记忆管理解决方案，');
console.log('   让我们的 AI 应用具备真正的智能记忆能力。');

// 清理资源
await chainsMemory.dispose();
chains.dispose();
