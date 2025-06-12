import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { agentLlmCommand } from './commands/agent-llm.js';
import { configCommand } from './commands/config.js';
import { llmCommand } from './commands/llm.js';
import { mcpCommand } from './commands/mcp.js';
import { toolsCommand } from './commands/tools.js';
import { UIDisplay, UILayout, UIList } from './ui/index.js';

// 获取当前模块的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json 获取版本号
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

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
  gitTools,
  networkTools,
  smartTools,
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

// MCP 模块
export * from './mcp/index.js';

const program = new Command();

// 设置基本信息
program.name('blade').description('🗡️ Blade - 智能 AI 助手命令行工具').version(version);

// 注册 LLM 相关命令
agentLlmCommand(program);
llmCommand(program);

// 注册配置相关命令
configCommand(program);

// 注册工具相关命令
toolsCommand(program);

// 注册 MCP 相关命令
mcpCommand(program);

// 添加帮助信息
program.on('--help', () => {
  UIDisplay.newline();
  UIDisplay.header('Blade 使用示例');
  UIDisplay.newline();

  // 智能对话示例
  UIDisplay.section('💬 智能对话');
  const chatExamples = [
    'blade chat 什么是人工智能',
    'blade chat 解释一下微服务架构',
    'blade chat --scenario customer 怎么退货',
    'blade chat --stream 详细解释机器学习',
  ];
  UIList.simple(chatExamples, { indent: 2 });
  UIDisplay.newline();

  // 交互式聊天示例
  UIDisplay.section('🔄 交互式聊天');
  const interactiveExamples = [
    'blade chat --interactive',
    'blade chat -i --scenario code --stream',
  ];
  UIList.simple(interactiveExamples, { indent: 2 });
  UIDisplay.newline();

  // 上下文记忆聊天示例
  UIDisplay.section('🧠 带上下文记忆的聊天');
  const contextExamples = [
    'blade chat --context --interactive',
    'blade chat --context "你还记得我之前问的问题吗？"',
    'blade chat --context --context-session my-session',
    'blade chat --context --context-user john --interactive',
  ];
  UIList.simple(contextExamples, { indent: 2 });
  UIDisplay.newline();

  // 场景演示示例
  UIDisplay.section('🎭 场景演示');
  const demoExamples = [
    'blade chat --demo --scenario assistant',
    'blade chat --demo --scenario customer',
  ];
  UIList.simple(demoExamples, { indent: 2 });
  UIDisplay.newline();

  // LLM 模式示例
  UIDisplay.section('🤖 纯 LLM 模式');
  const llmExamples = ['blade llm --stream', 'blade llm --provider volcengine'];
  UIList.simple(llmExamples, { indent: 2 });
  UIDisplay.newline();

  // 模型管理示例
  UIDisplay.section('📋 模型管理');
  const modelExamples = ['blade models --provider qwen', 'blade models --provider volcengine'];
  UIList.simple(modelExamples, { indent: 2 });
  UIDisplay.newline();

  // 配置管理示例
  UIDisplay.section('⚙️ 配置管理');
  const configExamples = [
    'blade config show',
    'blade config set-provider volcengine',
    'blade config set-model ep-20250530171222-q42h8',
    'blade config switch',
    'blade config wizard',
  ];
  UIList.simple(configExamples, { indent: 2 });
  UIDisplay.newline();

  // 工具管理示例
  UIDisplay.section('🔧 工具管理');
  const toolExamples = [
    'blade tools list',
    'blade tools info smart_code_review',
    'blade tools call uuid',
    'blade tools call command_confirmation \\\n    --params \'{"command": "ls -la", "description": "查看文件"}\'',
  ];
  UIList.simple(toolExamples, { indent: 2 });
  UIDisplay.newline();

  // MCP 支持示例
  UIDisplay.section('🔗 MCP 支持');
  const mcpExamples = [
    'blade mcp server start',
    'blade mcp config add',
    'blade mcp client connect my-server',
    'blade chat --mcp my-server "使用外部资源分析"',
  ];
  UIList.simple(mcpExamples, { indent: 2 });
  UIDisplay.newline();

  // 命令确认功能
  UILayout.card(
    '✨ 命令确认功能',
    [
      '• 📋 命令展示 - 清晰显示建议的命令和说明',
      '• 🔍 风险评估 - 自动显示命令的风险级别',
      '• ✅ 用户确认 - 交互式确认是否执行',
      '• ⚡ 实时执行 - 确认后立即执行命令',
      '• 📊 执行统计 - 显示执行时间和结果',
    ],
    { width: 60, style: 'rounded' }
  );
  UIDisplay.newline();

  // 提示信息
  UIDisplay.warning('💡 提示: 使用 "blade chat 你的问题" 进行智能对话');
  UIDisplay.muted('        使用命令确认工具安全执行AI建议的命令');
  UIDisplay.muted('        在对话中说"请使用命令确认工具执行..."');
});

if (!process.argv.slice(2).length) {
  UIDisplay.header('🗡️ 欢迎使用 Blade！');
  UIDisplay.newline();
  program.outputHelp();
  process.exit(0);
}

// 解析命令行参数
program.parse(process.argv);
