import chalk from 'chalk';
import { Command } from 'commander';
import { agentLlmCommand } from './commands/agent-llm.js';
import { llmCommand } from './commands/llm.js';
import { toolsCommand } from './commands/tools.js';

// 导出 Agent 和 LLM 相关模块
export { Agent, AgentConfig, AgentResponse, ToolCallResult } from './agent/Agent.js';
export { BaseComponent } from './agent/BaseComponent.js';
export { LoggerComponent } from './agent/LoggerComponent.js';
export { ToolComponent, ToolComponentConfig } from './agent/ToolComponent.js';

// LLM 模块
export { BaseLLM } from './llm/BaseLLM.js';
export { QwenLLM } from './llm/QwenLLM.js';
export { VolcEngineLLM } from './llm/VolcEngineLLM.js';

// 配置模块
export {
  DEFAULT_CONFIG,
  getProviderConfig,
  getSupportedProviders,
  isProviderSupported,
  loadConfigFromEnv,
} from './config/defaults.js';
export type { DefaultConfig, LLMProviderConfig } from './config/defaults.js';

// 工具模块
export {
  createToolManager,
  fileSystemTools,
  getAllBuiltinTools,
  getBuiltinToolsByCategory,
  networkTools,
  textProcessingTools,
  ToolExecutionError,
  ToolManager,
  ToolRegistrationError,
  ToolValidationError,
  ToolValidator,
  utilityTools,
} from './tools/index.js';

export type {
  ToolCallRequest,
  ToolCallResponse,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionHistory,
  ToolExecutionResult,
  ToolManagerConfig,
  ToolParameterSchema,
  ToolRegistrationOptions,
} from './tools/index.js';

// 类型定义
export type { LLMMessage, LLMRequest, LLMResponse } from './llm/BaseLLM.js';

const program = new Command();

// 设置基本信息
program.name('blade').description('🗡️ Blade - 智能 AI 助手命令行工具').version('1.1.0');

// 注册 LLM 相关命令
agentLlmCommand(program);
llmCommand(program);

// 注册工具相关命令
toolsCommand(program);

// 添加帮助信息
program.on('--help', () => {
  console.log('');
  console.log(chalk.blue('🚀 Blade 使用示例:'));
  console.log('');
  console.log(chalk.green('  💬 直接问答:'));
  console.log('  $ blade chat 什么是人工智能');
  console.log('  $ blade chat 解释一下微服务架构');
  console.log('  $ blade chat --scenario customer 怎么退货');
  console.log('');
  console.log(chalk.green('  🔄 交互式聊天:'));
  console.log('  $ blade chat --interactive');
  console.log('  $ blade chat -i --scenario code');
  console.log('');
  console.log(chalk.green('  🎭 场景演示:'));
  console.log('  $ blade chat --demo --scenario assistant');
  console.log('  $ blade chat --demo --scenario customer');
  console.log('');
  console.log(chalk.green('  🤖 纯 LLM 模式:'));
  console.log('  $ blade llm --stream');
  console.log('  $ blade llm --provider volcengine');
  console.log('');
  console.log(chalk.green('  📋 模型管理:'));
  console.log('  $ blade models --provider qwen');
  console.log('  $ blade models --provider volcengine');
  console.log('');
  console.log(chalk.green('  🔧 工具管理:'));
  console.log('  $ blade tools list');
  console.log('  $ blade tools info text_length');
  console.log('  $ blade tools call uuid');
  console.log('  $ blade tools docs');
  console.log('');
  console.log(chalk.yellow('💡 提示: 直接使用 "blade chat 你的问题" 开始对话'));
});

if (!process.argv.slice(2).length) {
  console.log(chalk.cyan('🗡️ 欢迎使用 Blade！'));
  console.log('');
  program.outputHelp();
  process.exit(0);
}

// 解析命令行参数
program.parse(process.argv);
