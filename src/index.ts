import chalk from 'chalk';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { llmCommand } from './commands/llm.js';
import { runCommand } from './commands/run.js';
export * from './agent/index.js';
export * from './llm/index.js';

// 主入口文件
export { Agent } from './agent/Agent.js';
export { BaseComponent } from './agent/BaseComponent.js';
export { LoggerComponent } from './agent/LoggerComponent.js';

// LLM 模块
export { BaseLLM } from './llm/BaseLLM.js';
export { QwenLLM } from './llm/QwenLLM.js';
export { VolcEngineLLM } from './llm/VolcEngineLLM.js';

// 配置模块
export { DEFAULT_CONFIG, getProviderConfig, getSupportedProviders, isProviderSupported, loadConfigFromEnv } from './config/defaults.js';
export type { DefaultConfig, LLMProviderConfig } from './config/defaults.js';

// 类型定义
export type {
  LLMMessage,
  LLMRequest,
  LLMResponse
} from './llm/BaseLLM.js';

const program = new Command();

// 设置基本信息
program
  .name('agent')
  .description('一个功能强大的 CLI 工具')
  .version('1.0.0');

// 注册命令
initCommand(program);
runCommand(program);
llmCommand(program);

// 添加帮助信息
program.on('--help', () => {
  console.log('');
  console.log(chalk.green('示例:'));
  console.log('  $ agent init myproject');
  console.log('  $ agent run --debug');
  console.log('  $ agent llm --provider qwen');
  console.log('  $ agent llm:models --provider volcengine');
});

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供任何命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 