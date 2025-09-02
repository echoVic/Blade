import React from 'react';
import { render } from 'ink';
import { Box, Text } from 'ink';

// 简化版CLI应用组件
const BladeCliApp: React.FC<{ config?: any; debug?: boolean }> = ({ config, debug }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">🚀 Blade CLI v1.3.0</Text>
      <Text color="blue">重构完成 - 采用新的 Monorepo 架构</Text>
      <Text>
        ✅ Core 包: @blade-ai/core (独立业务逻辑)
      </Text>
      <Text>
        ✅ CLI 包: @blade-ai/cli (纯应用层)
      </Text>
      <Text color="yellow">
        📋 详细信息请查看 REFACTORING_COMPLETION_SUMMARY.md
      </Text>
      {debug && (
        <Text color="gray">
          Debug mode: {JSON.stringify(config)}
        </Text>
      )}
    </Box>
  );
};

async function main() {
  try {
    // 获取命令行参数
    const args = process.argv.slice(2);
    const debug = args.includes('--debug');
    
    // CLI配置
    const config = {
      debug
    };
    
    // 渲染CLI应用
    render(React.createElement(BladeCliApp, { config, debug }));
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