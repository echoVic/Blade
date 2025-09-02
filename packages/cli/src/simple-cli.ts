#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Box, Text } from 'ink';

// 简化版REPL组件
const SimpleRepl = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">🚀 Blade CLI v1.3.0</Text>
      <Text color="blue">重构完成 - 采用新的 Monorepo 架构</Text>
      <Text>
        使用 packages/core (@blade-ai/core) 作为核心业务层
      </Text>
      <Text>
        使用 packages/cli 作为纯粹的应用层
      </Text>
      <Text color="yellow">
        请参考 REFACTORING_COMPLETION_SUMMARY.md 了解重构详情
      </Text>
    </Box>
  );
};

async function main() {
  try {
    // 渲染简化的CLI应用
    render(React.createElement(SimpleRepl));
  } catch (error) {
    console.error('启动Blade CLI失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动应用
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };